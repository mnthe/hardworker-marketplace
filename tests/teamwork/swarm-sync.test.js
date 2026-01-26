#!/usr/bin/env bun
/**
 * Tests for swarm-sync.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { runScript, mockProject } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/swarm-sync.js');

/**
 * Helper: Initialize a git repository in a directory
 */
function initGitRepo(dir) {
  // Initialize git repo
  spawnSync('git', ['init'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });

  // Create initial commit on main branch
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test Project\n');
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync('git', ['commit', '-m', 'Initial commit'], { cwd: dir });
  spawnSync('git', ['checkout', '-b', 'main'], { cwd: dir });
}

/**
 * Helper: Create a worktree for a worker
 */
function createWorktree(sourceDir, worktreePath, branchName) {
  const parentDir = path.dirname(worktreePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const result = spawnSync(
    'git',
    ['worktree', 'add', '-b', branchName, worktreePath],
    { cwd: sourceDir }
  );

  return result.status === 0;
}

/**
 * Helper: Add commit to main branch
 */
function addCommitToMain(sourceDir, content) {
  const testFile = path.join(sourceDir, 'test.txt');
  fs.writeFileSync(testFile, content);
  spawnSync('git', ['add', '.'], { cwd: sourceDir });
  spawnSync('git', ['commit', '-m', 'Update on main'], { cwd: sourceDir });
}

/**
 * Helper: Add commit to worktree branch
 */
function addCommitToWorktree(worktreePath, content) {
  const testFile = path.join(worktreePath, 'test.txt');
  fs.writeFileSync(testFile, content);
  spawnSync('git', ['add', '.'], { cwd: worktreePath });
  spawnSync('git', ['commit', '-m', 'Update on worker branch'], { cwd: worktreePath });
}

describe('swarm-sync.js', () => {
  let cleanup;
  let sourceDir;
  let worktreePath;

  beforeEach(() => {
    // Create source git repository
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-repo-'));
    initGitRepo(sourceDir);
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    // Clean up source directory
    if (sourceDir && fs.existsSync(sourceDir)) {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }

    // Clean up worktree if exists
    if (worktreePath && fs.existsSync(worktreePath)) {
      // Remove worktree from git
      try {
        spawnSync('git', ['worktree', 'remove', '--force', worktreePath], { cwd: sourceDir });
      } catch (e) {
        // Ignore errors
      }
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('swarm-sync');
  });

  test('syncs worktree with main branch successfully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm directory and worker state
    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    // Create worktree
    worktreePath = path.join(mock.projectDir, 'worktrees', 'w1');
    const branchName = 'worker-w1';
    createWorktree(sourceDir, worktreePath, branchName);

    // Create worker state
    const workerState = {
      id: 'w1',
      role: 'backend',
      pane: 1,
      worktree: worktreePath,
      branch: branchName,
      status: 'working'
    };
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify(workerState, null, 2)
    );

    // Add a commit to main
    addCommitToMain(sourceDir, 'main content\n');

    // Run sync script
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      'worker-id': 'w1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.status).toBe('success');
    expect(result.json.worker_id).toBe('w1');
    expect(result.json.worktree).toBe(worktreePath);
  });

  test('returns conflict error when rebase fails', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm directory and worker state
    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    // Create worktree
    worktreePath = path.join(mock.projectDir, 'worktrees', 'w1');
    const branchName = 'worker-w1';
    createWorktree(sourceDir, worktreePath, branchName);

    // Create worker state
    const workerState = {
      id: 'w1',
      role: 'backend',
      pane: 1,
      worktree: worktreePath,
      branch: branchName,
      status: 'working'
    };
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify(workerState, null, 2)
    );

    // Create conflicting changes
    // 1. Add commit to main
    addCommitToMain(sourceDir, 'main version\n');

    // 2. Add conflicting commit to worktree
    addCommitToWorktree(worktreePath, 'worktree version\n');

    // Run sync script
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      'worker-id': 'w1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.status).toBe('conflict');
    expect(result.json.worker_id).toBe('w1');
    expect(result.json.error).toContain('Rebase failed');
  });

  test('fails without required project parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      team: 'test-team',
      'worker-id': 'w1'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required team parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      'worker-id': 'w1'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required worker-id parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails with non-existent worker', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm directory but no worker state
    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      'worker-id': 'nonexistent'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Worker not found');
  });
});
