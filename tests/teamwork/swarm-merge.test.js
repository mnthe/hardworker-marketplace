#!/usr/bin/env bun
/**
 * Tests for swarm-merge.js
 * Verifies merging worker worktrees to main branch
 */

const { test, expect, beforeAll, afterAll, describe } = require("bun:test");
const { runScript, mockProject, TEAMWORK_TEST_BASE_DIR } = require("../test-utils.js");
const path = require("path");
const fs = require("fs");
const { spawnSync, execSync } = require("child_process");

const SCRIPT_PATH = path.resolve(__dirname, "../../plugins/teamwork/src/scripts/swarm-merge.js");

// Helper to check if git is available
function isGitAvailable() {
  const result = spawnSync("which", ["git"], { encoding: "utf-8" });
  return result.status === 0;
}

const GIT_AVAILABLE = isGitAvailable();

// Helper to initialize a git repository
function initGitRepo(repoPath) {
  if (!fs.existsSync(repoPath)) {
    fs.mkdirSync(repoPath, { recursive: true });
  }

  execSync("git init", { cwd: repoPath, stdio: "ignore" });
  execSync("git config user.email 'test@example.com'", { cwd: repoPath, stdio: "ignore" });
  execSync("git config user.name 'Test User'", { cwd: repoPath, stdio: "ignore" });

  // Create initial commit on main
  fs.writeFileSync(path.join(repoPath, "README.md"), "# Test Project\n", "utf-8");
  execSync("git add .", { cwd: repoPath, stdio: "ignore" });
  execSync("git commit -m 'Initial commit'", { cwd: repoPath, stdio: "ignore" });

  // Ensure we're on main branch
  try {
    execSync("git branch -M main", { cwd: repoPath, stdio: "ignore" });
  } catch {
    // Branch already named main
  }
}

// Helper to create worker branches
function createWorkerBranch(repoPath, branchName, fileName, content) {
  execSync(`git checkout -b ${branchName}`, { cwd: repoPath, stdio: "ignore" });
  fs.writeFileSync(path.join(repoPath, fileName), content, "utf-8");
  execSync("git add .", { cwd: repoPath, stdio: "ignore" });
  execSync(`git commit -m 'Add ${fileName}'`, { cwd: repoPath, stdio: "ignore" });
  execSync("git checkout main", { cwd: repoPath, stdio: "ignore" });
}

// Helper to create swarm state
function createSwarmState(projectDir, workers, sourceDir) {
  const swarmDir = path.join(projectDir, "swarm");
  const workersDir = path.join(swarmDir, "workers");

  fs.mkdirSync(swarmDir, { recursive: true });
  fs.mkdirSync(workersDir, { recursive: true });

  // Create swarm.json
  const swarmData = {
    session: "test-session",
    status: "running",
    created_at: new Date().toISOString(),
    workers: workers.map(w => w.id),
    current_wave: 1,
    paused: false,
    use_worktree: true,
    source_dir: sourceDir
  };

  fs.writeFileSync(
    path.join(swarmDir, "swarm.json"),
    JSON.stringify(swarmData, null, 2),
    "utf-8"
  );

  // Create worker files
  for (const worker of workers) {
    const workerData = {
      id: worker.id,
      role: worker.role,
      pane: worker.pane,
      worktree: worker.worktree,
      branch: worker.branch,
      status: "idle",
      current_task: null,
      tasks_completed: [],
      last_heartbeat: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(workersDir, `${worker.id}.json`),
      JSON.stringify(workerData, null, 2),
      "utf-8"
    );
  }
}

describe("swarm-merge.js", () => {
  test("--help shows usage information", () => {
    const result = runScript(SCRIPT_PATH, { help: true });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("--project");
    expect(result.stdout).toContain("--team");
    expect(result.stdout).toContain("--wave");
    expect(result.stdout).toContain("--source-dir");
  });

  test("fails without --project parameter", () => {
    const result = runScript(SCRIPT_PATH, {
      team: "master",
      wave: "1",
      "source-dir": "/tmp/test"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--project");
  });

  test("fails without --team parameter", () => {
    const result = runScript(SCRIPT_PATH, {
      project: "test",
      wave: "1",
      "source-dir": "/tmp/test"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--team");
  });

  test("fails without --wave parameter", () => {
    const result = runScript(SCRIPT_PATH, {
      project: "test",
      team: "master",
      "source-dir": "/tmp/test"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--wave");
  });

  test("fails without --source-dir parameter", () => {
    const result = runScript(SCRIPT_PATH, {
      project: "test",
      team: "master",
      wave: "1"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--source-dir");
  });

  test("fails with invalid wave number", () => {
    const result = runScript(SCRIPT_PATH, {
      project: "test",
      team: "master",
      wave: "invalid",
      "source-dir": "/tmp/test"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("positive integer");
  });

  if (GIT_AVAILABLE) {
    describe("with git repository", () => {
      let project;
      let repoPath;

      beforeAll(() => {
        // Create mock project
        project = mockProject({
          project: "merge-test",
          team: "master",
          goal: "Test swarm merging"
        });

        // Create git repository
        repoPath = path.join(TEAMWORK_TEST_BASE_DIR, "test-repo");
        initGitRepo(repoPath);
      });

      afterAll(() => {
        // Clean up
        project.cleanup();

        if (fs.existsSync(repoPath)) {
          fs.rmSync(repoPath, { recursive: true, force: true });
        }
      });

      test("fails when swarm not initialized", () => {
        const result = runScript(SCRIPT_PATH, {
          project: project.project,
          team: project.team,
          wave: "1",
          "source-dir": repoPath
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Swarm not initialized");
      });

      test("merges worker branches successfully", () => {
        // Create worker branches
        createWorkerBranch(repoPath, "worker-w1", "file1.txt", "Worker 1 content\n");
        createWorkerBranch(repoPath, "worker-w2", "file2.txt", "Worker 2 content\n");

        // Create swarm state
        createSwarmState(project.projectDir, [
          { id: "w1", role: "backend", pane: 0, worktree: null, branch: "worker-w1" },
          { id: "w2", role: "frontend", pane: 1, worktree: null, branch: "worker-w2" }
        ], repoPath);

        // Run merge
        const result = runScript(SCRIPT_PATH, {
          project: project.project,
          team: project.team,
          wave: "1",
          "source-dir": repoPath
        });

        expect(result.exitCode).toBe(0);

        const output = JSON.parse(result.stdout);
        expect(output.status).toBe("success");
        expect(output.wave).toBe(1);
        expect(output.merged).toContain("w1");
        expect(output.merged).toContain("w2");
      });

      test("handles merge conflicts correctly", () => {
        // Reset repo
        execSync("git reset --hard HEAD", { cwd: repoPath, stdio: "ignore" });

        // Create conflicting worker branches
        createWorkerBranch(repoPath, "worker-w3", "conflict.txt", "Worker 3 version\n");

        // Modify same file on main
        fs.writeFileSync(path.join(repoPath, "conflict.txt"), "Main version\n", "utf-8");
        execSync("git add .", { cwd: repoPath, stdio: "ignore" });
        execSync("git commit -m 'Main version'", { cwd: repoPath, stdio: "ignore" });

        createWorkerBranch(repoPath, "worker-w4", "file4.txt", "Worker 4 content\n");

        // Create swarm state with conflicting worker first
        createSwarmState(project.projectDir, [
          { id: "w3", role: "backend", pane: 0, worktree: null, branch: "worker-w3" },
          { id: "w4", role: "frontend", pane: 1, worktree: null, branch: "worker-w4" }
        ], repoPath);

        // Run merge
        const result = runScript(SCRIPT_PATH, {
          project: project.project,
          team: project.team,
          wave: "1",
          "source-dir": repoPath
        });

        expect(result.exitCode).toBe(1);

        const output = JSON.parse(result.stdout);
        expect(output.status).toBe("conflict");
        expect(output.conflict_at).toBe("w3");
        expect(output.conflict_files).toContain("conflict.txt");
        expect(output.merged_before_conflict).toEqual([]);
        expect(output.not_merged).toContain("w3");
        expect(output.not_merged).toContain("w4");

        // Verify swarm is paused
        const swarmFile = path.join(project.projectDir, "swarm", "swarm.json");
        const swarmData = JSON.parse(fs.readFileSync(swarmFile, "utf-8"));
        expect(swarmData.paused).toBe(true);
      });

      test("fails when working directory has uncommitted changes", () => {
        // Reset repo
        execSync("git reset --hard HEAD", { cwd: repoPath, stdio: "ignore" });

        // Create uncommitted change
        fs.writeFileSync(path.join(repoPath, "uncommitted.txt"), "Uncommitted\n", "utf-8");

        createSwarmState(project.projectDir, [
          { id: "w1", role: "backend", pane: 0, worktree: null, branch: "worker-w1" }
        ], repoPath);

        const result = runScript(SCRIPT_PATH, {
          project: project.project,
          team: project.team,
          wave: "1",
          "source-dir": repoPath
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("uncommitted changes");

        // Clean up
        fs.unlinkSync(path.join(repoPath, "uncommitted.txt"));
      });
    });
  } else {
    test.skip("git not available, skipping git-dependent tests", () => {});
  }
});
