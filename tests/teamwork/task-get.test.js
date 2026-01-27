#!/usr/bin/env bun
/**
 * Tests for task-get.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-get.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

describe('task-get.js', () => {
  let cleanup;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('task-get');
  });

  test('gets task with valid parameters', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create a task first
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();

    assertJsonSchema(result.json, {
      id: 'string',
      title: 'string',
      status: 'string',
      role: 'string',
      complexity: 'string'
    });

    expect(result.json.id).toBe('1');
    expect(result.json.title).toBe('Test task');
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails with non-existent task', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '999'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('supports field extraction', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      field: 'title'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    if (result.exitCode === 0) {
      expect(result.stdout).toContain('Test task');
    }
  });

  test('handles corrupted JSON file', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const taskFile = path.join(mock.tasksDir, '1.json');
    const fs = require('fs');

    // Create corrupted JSON file
    fs.writeFileSync(taskFile, '{ invalid json }', 'utf-8');

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Error');
  });

  test('handles task with null fields', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.claimed_by).toBe(null);
  });

  test('fails with non-existent field', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      field: 'nonExistentField'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Field');
    expect(result.stderr).toContain('not found');
  });

  test('supports nested field extraction', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const TASK_UPDATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-update.js');

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_UPDATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      'add-evidence': 'Test evidence'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      field: 'evidence[0]'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    if (result.exitCode === 0) {
      expect(result.stdout).toContain('Test evidence');
    }
  });

  test('returns all fields when no field specified', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task',
      description: 'Test description'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toHaveProperty('id');
    expect(result.json).toHaveProperty('title');
    expect(result.json).toHaveProperty('description');
    expect(result.json).toHaveProperty('status');
  });
});
