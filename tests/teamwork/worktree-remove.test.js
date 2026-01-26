#!/usr/bin/env bun
/**
 * Tests for worktree-remove.js
 */

const { test, expect, describe, afterAll, beforeAll, beforeEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, mockProject, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');
const { spawnSync } = require('child_process');

const CREATE_SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/worktree-create.js');
const REMOVE_SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/worktree-remove.js');

describe('worktree-remove.js', () => {
  let testRepoDir;
  let projectName;
  let teamName;

  beforeAll(() => {
    // Create a temporary git repository for testing worktrees
    testRepoDir = path.join(TEAMWORK_TEST_BASE_DIR, 'test-git-repo');
    fs.mkdirSync(testRepoDir, { recursive: true });

    // Initialize git repo
    spawnSync('git', ['init'], { cwd: testRepoDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: testRepoDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoDir });

    // Create initial commit
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Test Repo\n');
    spawnSync('git', ['add', '.'], { cwd: testRepoDir });
    spawnSync('git', ['commit', '-m', 'Initial commit'], { cwd: testRepoDir });

    // Set up mock project
    const project = mockProject({ project: 'worktree-remove-test', team: 'main' });
    projectName = project.project;
    teamName = project.team;
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up any existing worktrees from previous tests
    const worktreesDir = path.join(TEAMWORK_TEST_BASE_DIR, projectName, teamName, 'worktrees');
    if (fs.existsSync(worktreesDir)) {
      fs.rmSync(worktreesDir, { recursive: true, force: true });
    }

    // Clean up any worker branches
    const branches = spawnSync('git', ['branch', '--list', 'worker-*'], {
      cwd: testRepoDir,
      encoding: 'utf-8'
    });
    if (branches.stdout) {
      branches.stdout.split('\n').forEach(branch => {
        const branchName = branch.trim().replace('*', '').trim();
        if (branchName.startsWith('worker-')) {
          spawnSync('git', ['worktree', 'remove', '--force', path.join(worktreesDir, branchName.replace('worker-', ''))], {
            cwd: testRepoDir
          });
          spawnSync('git', ['branch', '-D', branchName], {
            cwd: testRepoDir
          });
        }
      });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(REMOVE_SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('worktree-remove');
  });

  test('removes worktree and branch with valid parameters', () => {
    // First create a worktree
    const createResult = runScript(CREATE_SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'worker-id': 'w1',
      'source-dir': testRepoDir
    });
    expect(createResult.exitCode).toBe(0);

    const worktreePath = path.join(TEAMWORK_TEST_BASE_DIR, projectName, teamName, 'worktrees', 'w1');
    expect(fs.existsSync(worktreePath)).toBe(true);

    // Now remove the worktree
    const removeResult = runScript(REMOVE_SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'worker-id': 'w1',
      'source-dir': testRepoDir
    });

    expect(removeResult.exitCode).toBe(0);
    expect(removeResult.stdout).toContain('OK:');
    expect(removeResult.json).toBeTruthy();

    // Validate JSON output structure
    expect(removeResult.json.status).toBe('success');
    expect(removeResult.json.removed).toBeTruthy();

    // Check worktree was actually removed
    expect(fs.existsSync(worktreePath)).toBe(false);

    // Verify branch was deleted from source repo
    const listResult = spawnSync('git', ['branch', '--list', 'worker-w1'], {
      cwd: testRepoDir,
      encoding: 'utf-8'
    });
    expect(listResult.stdout.trim()).toBe('');
  });

  test('fails without required --project parameter', () => {
    const result = runScript(REMOVE_SCRIPT_PATH, {
      team: teamName,
      'worker-id': 'w2',
      'source-dir': testRepoDir
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --team parameter', () => {
    const result = runScript(REMOVE_SCRIPT_PATH, {
      project: projectName,
      'worker-id': 'w2',
      'source-dir': testRepoDir
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --worker-id parameter', () => {
    const result = runScript(REMOVE_SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'source-dir': testRepoDir
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --source-dir parameter', () => {
    const result = runScript(REMOVE_SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'worker-id': 'w2'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('succeeds even if worktree does not exist (idempotent)', () => {
    // Try to remove a worktree that was never created
    const result = runScript(REMOVE_SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'worker-id': 'nonexistent',
      'source-dir': testRepoDir
    });

    // Should succeed (idempotent operation)
    expect(result.exitCode).toBe(0);
    expect(result.json.status).toBe('success');
  });

  test('fails when source-dir is not a git repository', () => {
    const nonGitDir = path.join(TEAMWORK_TEST_BASE_DIR, 'non-git-dir');
    fs.mkdirSync(nonGitDir, { recursive: true });

    const result = runScript(REMOVE_SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'worker-id': 'w3',
      'source-dir': nonGitDir
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not a git repository');
  });
});
