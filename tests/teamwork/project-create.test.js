#!/usr/bin/env bun
/**
 * Tests for project-create.js
 */

const { test, expect, describe, afterAll } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, assertJsonSchema, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/project-create.js');

describe('project-create.js', () => {
  afterAll(() => {
    // Clean up test projects
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

  test('creates project with valid parameters', () => {
    // Use TEAMWORK_TEST_BASE_DIR for path assertions
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'create-test-project', 'create-test-team');
    const projectFile = path.join(projectDir, 'project.json');

    const result = runScript(SCRIPT_PATH, {
      project: 'create-test-project',
      team: 'create-test-team',
      goal: 'Build API'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Project created');
    expect(result.json).toBeTruthy();

    // Validate JSON schema
    assertJsonSchema(result.json, {
      project: 'string',
      team: 'string',
      goal: 'string',
      created_at: 'string',
      updated_at: 'string',
      stats: 'object'
    });

    expect(result.json.project).toBe('create-test-project');
    expect(result.json.team).toBe('create-test-team');
    expect(result.json.goal).toBe('Build API');

    // Check file was created in test isolation directory
    expect(fs.existsSync(projectFile)).toBe(true);
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('creates tasks directory', () => {
    const tasksDir = path.join(TEAMWORK_TEST_BASE_DIR, 'tasks-test-project', 'tasks-test-team', 'tasks');

    const result = runScript(SCRIPT_PATH, {
      project: 'tasks-test-project',
      team: 'tasks-test-team',
      goal: 'Test goal'
    });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(tasksDir)).toBe(true);
  });

  test('sets initial stats to zero', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'stats-test-project',
      team: 'stats-test-team',
      goal: 'Test goal'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.stats.total).toBe(0);
    expect(result.json.stats.open).toBe(0);
    expect(result.json.stats.in_progress).toBe(0);
    expect(result.json.stats.resolved).toBe(0);
  });
});
