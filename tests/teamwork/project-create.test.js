#!/usr/bin/env bun
/**
 * Tests for project-create.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, createTempDir, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/project-create.js');

describe('project-create.js', () => {
  let tempDir;

  beforeEach(() => {
    const temp = createTempDir('teamwork-test-');
    tempDir = temp.path;
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('project-create');
  });

  test('creates project with valid parameters', () => {
    const projectDir = path.join(tempDir, '.claude', 'teamwork', 'test-project', 'test-team');
    const projectFile = path.join(projectDir, 'project.json');

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      goal: 'Build API'
    }, {
      env: { ...process.env, HOME: tempDir }
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

    expect(result.json.project).toBe('test-project');
    expect(result.json.team).toBe('test-team');
    expect(result.json.goal).toBe('Build API');

    // Check file was created
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
    const tasksDir = path.join(tempDir, '.claude', 'teamwork', 'test-project', 'test-team', 'tasks');

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      goal: 'Test goal'
    }, {
      env: { ...process.env, HOME: tempDir }
    });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(tasksDir)).toBe(true);
  });

  test('sets initial stats to zero', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      goal: 'Test goal'
    }, {
      env: { ...process.env, HOME: tempDir }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.stats.total).toBe(0);
    expect(result.json.stats.open).toBe(0);
    expect(result.json.stats.in_progress).toBe(0);
    expect(result.json.stats.resolved).toBe(0);
  });
});
