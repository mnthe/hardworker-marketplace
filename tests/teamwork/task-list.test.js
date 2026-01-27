#!/usr/bin/env bun
/**
 * Tests for task-list.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-list.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

describe('task-list.js', () => {
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
    expect(result.stdout).toContain('task-list');
  });

  test('lists tasks in JSON format', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create tasks
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task 1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '2',
      title: 'Task 2'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(Array.isArray(result.json)).toBe(true);
    expect(result.json.length).toBe(2);
  });

  test('lists tasks in table format', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task 1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'table'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('ID|STATUS|ROLE');
    expect(result.stdout).toContain('1|open');
  });

  test('filters by role', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Backend task',
      role: 'backend'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '2',
      title: 'Frontend task',
      role: 'frontend'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      role: 'backend',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.length).toBe(1);
    expect(result.json[0].role).toBe('backend');
  });

  test('filters available tasks', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Open task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      available: '',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.length).toBe(1);
    expect(result.json[0].status).toBe('open');
    expect(result.json[0].claimed_by).toBe(null);
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('handles empty task directory', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // List tasks when no tasks exist
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toEqual([]);
  });

  test('filters by non-existent role returns empty list', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Backend task',
      role: 'backend'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Filter by non-existent role
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      role: 'non-existent-role',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.length).toBe(0);
  });

  test('filters by multiple statuses', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const TASK_UPDATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-update.js');

    // Create tasks with different statuses
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Open task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '2',
      title: 'Resolved task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_UPDATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '2',
      status: 'resolved'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Filter by open status
    const openResult = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      status: 'open',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(openResult.exitCode).toBe(0);
    expect(openResult.json.length).toBe(1);
    expect(openResult.json[0].status).toBe('open');

    // Filter by resolved status
    const resolvedResult = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      status: 'resolved',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(resolvedResult.exitCode).toBe(0);
    expect(resolvedResult.json.length).toBe(1);
    expect(resolvedResult.json[0].status).toBe('resolved');
  });

  test('handles large number of tasks', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create 25 tasks
    for (let i = 1; i <= 25; i++) {
      runScript(TASK_CREATE_PATH, {
        project: 'test-project',
        team: 'test-team',
        id: String(i),
        title: `Task ${i}`
      }, {
        env: { ...process.env, HOME: os.tmpdir() }
      });
    }

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.length).toBe(25);
  });

  test('handles tasks with missing optional fields', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create task with minimal fields
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Minimal task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.length).toBe(1);
    expect(result.json[0].title).toBe('Minimal task');
  });
});
