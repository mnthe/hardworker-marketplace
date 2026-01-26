#!/usr/bin/env bun
/**
 * Tests for worktree-create.js
 */

const { test, expect, describe, afterAll, beforeAll } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, mockProject, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');
const { spawnSync } = require('child_process');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/worktree-create.js');

describe('worktree-create.js', () => {
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
    const project = mockProject({ project: 'worktree-test', team: 'main' });
    projectName = project.project;
    teamName = project.team;
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('worktree-create');
  });

  test('creates worktree with valid parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'worker-id': 'w1',
      'source-dir': testRepoDir
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK:');
    expect(result.json).toBeTruthy();

    // Validate JSON output structure
    expect(result.json.status).toBe('success');
    expect(result.json.worktree).toBeTruthy();
    expect(result.json.branch).toBe('worker-w1');

    // Check worktree was actually created
    const worktreePath = path.join(TEAMWORK_TEST_BASE_DIR, projectName, teamName, 'worktrees', 'w1');
    expect(fs.existsSync(worktreePath)).toBe(true);

    // Verify it's a valid git worktree
    expect(fs.existsSync(path.join(worktreePath, '.git'))).toBe(true);

    // Verify branch exists in source repo
    const listResult = spawnSync('git', ['branch', '--list', 'worker-w1'], {
      cwd: testRepoDir,
      encoding: 'utf-8'
    });
    expect(listResult.stdout).toContain('worker-w1');
  });

  test('fails without required --project parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      team: teamName,
      'worker-id': 'w2',
      'source-dir': testRepoDir
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --team parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: projectName,
      'worker-id': 'w2',
      'source-dir': testRepoDir
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --worker-id parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'source-dir': testRepoDir
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --source-dir parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'worker-id': 'w2'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails when source-dir is not a git repository', () => {
    const nonGitDir = path.join(TEAMWORK_TEST_BASE_DIR, 'non-git-dir');
    fs.mkdirSync(nonGitDir, { recursive: true });

    const result = runScript(SCRIPT_PATH, {
      project: projectName,
      team: teamName,
      'worker-id': 'w3',
      'source-dir': nonGitDir
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not a git repository');
  });

  test('creates nested worktree directory if it does not exist', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'new-project',
      team: 'new-team',
      'worker-id': 'w4',
      'source-dir': testRepoDir
    });

    expect(result.exitCode).toBe(0);

    const worktreePath = path.join(TEAMWORK_TEST_BASE_DIR, 'new-project', 'new-team', 'worktrees', 'w4');
    expect(fs.existsSync(worktreePath)).toBe(true);
  });
});
