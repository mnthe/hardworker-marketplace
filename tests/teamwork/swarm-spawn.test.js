#!/usr/bin/env bun
/**
 * Tests for swarm-spawn.js
 * Verifies tmux session creation, pane splitting, and worker spawning
 */

const { test, expect, beforeAll, afterAll, describe } = require("bun:test");
const { runScript, mockProject, TEAMWORK_TEST_BASE_DIR } = require("../test-utils.js");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const SCRIPT_PATH = path.resolve(__dirname, "../../plugins/teamwork/src/scripts/swarm-spawn.js");

// Check if tmux is available
function isTmuxAvailable() {
  const result = spawnSync("which", ["tmux"], { encoding: "utf-8" });
  return result.status === 0;
}

const TMUX_AVAILABLE = isTmuxAvailable();

// Helper to clean up tmux sessions created during tests
function cleanupTmuxSession(sessionName) {
  if (!TMUX_AVAILABLE) return;

  // Kill session if it exists (ignore errors)
  spawnSync("tmux", ["kill-session", "-t", sessionName], {
    encoding: "utf-8",
    stdio: "ignore"
  });
}

describe("swarm-spawn.js", () => {
  let project;
  let testSessionName;

  beforeAll(() => {
    if (!TMUX_AVAILABLE) {
      console.log("⚠️  tmux not available, skipping tmux-dependent tests");
    }

    // Create mock project
    project = mockProject({
      project: "swarm-test",
      team: "master",
      goal: "Test swarm spawning"
    });

    testSessionName = `teamwork-test-${Date.now()}`;
  });

  afterAll(() => {
    // Clean up test project
    project.cleanup();

    // Clean up any remaining tmux sessions
    cleanupTmuxSession(testSessionName);
  });

  test("--help shows usage information", () => {
    const result = runScript(SCRIPT_PATH, { help: true });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("--project");
    expect(result.stdout).toContain("--team");
    expect(result.stdout).toContain("--role");
  });

  test("fails without --project parameter", () => {
    const result = runScript(SCRIPT_PATH, {
      team: "master"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--project");
  });

  test("fails without --team parameter", () => {
    const result = runScript(SCRIPT_PATH, {
      project: "test"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--team");
  });

  test("fails without --role or --roles parameter", () => {
    const result = runScript(SCRIPT_PATH, {
      project: "test",
      team: "master"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("role");
  });

  if (TMUX_AVAILABLE) {
    test("creates tmux session with single worker", () => {
      const result = runScript(SCRIPT_PATH, {
        project: project.project,
        team: project.team,
        role: "backend",
        "session-name": testSessionName
      }, {
        env: {
          HOME: path.dirname(path.dirname(TEAMWORK_TEST_BASE_DIR))
        }
      });

      // Should succeed
      expect(result.exitCode).toBe(0);

      // Should output JSON
      expect(result.json).toBeTruthy();
      expect(result.json.status).toBe("success");
      expect(result.json.session).toBe(testSessionName);

      // Should have worker info
      expect(Array.isArray(result.json.workers)).toBe(true);
      expect(result.json.workers.length).toBeGreaterThan(0);

      const worker = result.json.workers[0];
      expect(worker.id).toBeTruthy();
      expect(worker.role).toBe("backend");
      expect(typeof worker.pane).toBe("number");

      // Verify tmux session was created
      const checkSession = spawnSync("tmux", ["has-session", "-t", testSessionName], {
        encoding: "utf-8"
      });
      expect(checkSession.status).toBe(0);

      // Clean up
      cleanupTmuxSession(testSessionName);
    });

    test("spawns multiple workers with --count option", () => {
      const sessionName = `${testSessionName}-multi`;

      const result = runScript(SCRIPT_PATH, {
        project: project.project,
        team: project.team,
        role: "backend",
        count: "2",
        "session-name": sessionName
      }, {
        env: {
          HOME: path.dirname(path.dirname(TEAMWORK_TEST_BASE_DIR))
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.json.workers.length).toBe(2);

      // Both workers should have backend role
      expect(result.json.workers[0].role).toBe("backend");
      expect(result.json.workers[1].role).toBe("backend");

      // Should have different worker IDs
      expect(result.json.workers[0].id).not.toBe(result.json.workers[1].id);

      cleanupTmuxSession(sessionName);
    });

    test("spawns workers with multiple roles using --roles", () => {
      const sessionName = `${testSessionName}-roles`;

      const result = runScript(SCRIPT_PATH, {
        project: project.project,
        team: project.team,
        roles: "backend,frontend",
        "session-name": sessionName
      }, {
        env: {
          HOME: path.dirname(path.dirname(TEAMWORK_TEST_BASE_DIR))
        }
      });

      expect(result.exitCode).toBe(0);
      expect(result.json.workers.length).toBe(2);

      // Should have different roles
      const roles = result.json.workers.map(w => w.role).sort();
      expect(roles).toEqual(["backend", "frontend"]);

      cleanupTmuxSession(sessionName);
    });

    test("creates worktree paths when --worktree flag is used", () => {
      const sessionName = `${testSessionName}-worktree`;

      const result = runScript(SCRIPT_PATH, {
        project: project.project,
        team: project.team,
        role: "backend",
        worktree: "true",
        "session-name": sessionName
      }, {
        env: {
          HOME: path.dirname(path.dirname(TEAMWORK_TEST_BASE_DIR))
        }
      });

      expect(result.exitCode).toBe(0);

      // Workers should have worktree field
      const worker = result.json.workers[0];
      expect(worker.worktree).toBeTruthy();
      expect(typeof worker.worktree).toBe("string");

      cleanupTmuxSession(sessionName);
    });

    test("uses default session name when not specified", () => {
      const result = runScript(SCRIPT_PATH, {
        project: project.project,
        team: project.team,
        role: "backend"
      }, {
        env: {
          HOME: path.dirname(path.dirname(TEAMWORK_TEST_BASE_DIR))
        }
      });

      expect(result.exitCode).toBe(0);

      // Default should be teamwork-{project}
      const expectedSession = `teamwork-${project.project}`;
      expect(result.json.session).toBe(expectedSession);

      cleanupTmuxSession(expectedSession);
    });

    test("creates swarm state directory and files", () => {
      const sessionName = `${testSessionName}-state`;

      const result = runScript(SCRIPT_PATH, {
        project: project.project,
        team: project.team,
        role: "backend",
        "session-name": sessionName
      }, {
        env: {
          HOME: path.dirname(path.dirname(TEAMWORK_TEST_BASE_DIR))
        }
      });

      expect(result.exitCode).toBe(0);

      // Verify swarm directory was created
      const swarmDir = path.join(TEAMWORK_TEST_BASE_DIR, project.project, project.team, "swarm");
      expect(fs.existsSync(swarmDir)).toBe(true);

      // Verify swarm.json was created
      const swarmFile = path.join(swarmDir, "swarm.json");
      expect(fs.existsSync(swarmFile)).toBe(true);

      // Verify swarm.json content
      const swarmData = JSON.parse(fs.readFileSync(swarmFile, "utf-8"));
      expect(swarmData.session).toBe(sessionName);
      expect(swarmData.status).toBe("running");
      expect(Array.isArray(swarmData.workers)).toBe(true);

      cleanupTmuxSession(sessionName);
    });
  } else {
    test.skip("tmux tests skipped (tmux not available)", () => {});
  }
});
