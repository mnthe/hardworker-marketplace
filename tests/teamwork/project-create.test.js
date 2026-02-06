#!/usr/bin/env bun
/**
 * Tests for project-create.js (v3 - lightweight metadata only)
 */

const { test, expect, describe, afterEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, assertJsonSchema, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/project-create.js');

describe('project-create.js v3', () => {
  afterEach(() => {
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('project-create');
  });

  test('creates lightweight metadata file with valid params', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'create-test',
      team: 'dev',
      goal: 'Build API'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();

    // Validate v3 schema - lightweight metadata
    assertJsonSchema(result.json, {
      project: 'string',
      team: 'string',
      goal: 'string',
      created_at: 'string'
    });

    expect(result.json.project).toBe('create-test');
    expect(result.json.team).toBe('dev');
    expect(result.json.goal).toBe('Build API');
  });

  test('creates project.json file on disk', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'disk-test',
      team: 'alpha',
      goal: 'Test disk write'
    });

    expect(result.exitCode).toBe(0);

    // Verify file exists in test isolation directory
    const projectFile = path.join(TEAMWORK_TEST_BASE_DIR, 'disk-test', 'alpha', 'project.json');
    expect(fs.existsSync(projectFile)).toBe(true);

    // Verify file content
    const content = JSON.parse(fs.readFileSync(projectFile, 'utf-8'));
    expect(content.project).toBe('disk-test');
    expect(content.team).toBe('alpha');
    expect(content.goal).toBe('Test disk write');
  });

  test('does NOT create tasks directory (native handles tasks)', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'no-tasks',
      team: 'beta',
      goal: 'Test no tasks dir'
    });

    expect(result.exitCode).toBe(0);

    // v3: No tasks directory should be created
    const tasksDir = path.join(TEAMWORK_TEST_BASE_DIR, 'no-tasks', 'beta', 'tasks');
    expect(fs.existsSync(tasksDir)).toBe(false);
  });

  test('does NOT include stats field (no wave system)', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'no-stats',
      team: 'gamma',
      goal: 'Test no stats'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();

    // v3: No stats field - native TaskList handles that
    expect(result.json.stats).toBeUndefined();
  });

  test('supports optional --options parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'opts-test',
      team: 'delta',
      goal: 'Test options',
      options: JSON.stringify({ workers: 3, worktree: true })
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.options).toBeTruthy();
    expect(result.json.options.workers).toBe(3);
    expect(result.json.options.worktree).toBe(true);
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('handles empty goal', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'empty-goal',
      team: 'epsilon',
      goal: ''
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.goal).toBe('');
  });

  test('sets created_at timestamp', () => {
    const before = new Date().toISOString();

    const result = runScript(SCRIPT_PATH, {
      project: 'timestamp-test',
      team: 'zeta',
      goal: 'Timestamp check'
    });

    const after = new Date().toISOString();

    expect(result.exitCode).toBe(0);
    expect(result.json.created_at).toBeTruthy();
    expect(result.json.created_at >= before).toBe(true);
    expect(result.json.created_at <= after).toBe(true);
  });
});
