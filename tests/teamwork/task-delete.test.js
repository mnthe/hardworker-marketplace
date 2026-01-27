#!/usr/bin/env bun
/**
 * Tests for task-delete.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-delete.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

describe('task-delete.js', () => {
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
    expect(result.stdout).toContain('task-delete');
  });

  test('deletes task successfully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create task
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const taskFile = path.join(mock.tasksDir, '1.json');
    // Verify task was created
    const taskCreated = fs.existsSync(taskFile);
    if (!taskCreated) {
      console.log('Task file not found at:', taskFile);
    }
    expect(taskCreated).toBe(true);

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Task 1 deleted');
    expect(fs.existsSync(taskFile)).toBe(false);
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
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

  test('handles project without tasks directory', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    fs.rmSync(mock.tasksDir, { recursive: true, force: true });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('fails to delete in_progress task', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const TASK_CLAIM_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-claim.js');

    // Create and claim task
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_CLAIM_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Try to delete in_progress task
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('EXECUTION phase');
  });

  test('fails to delete resolved task', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const TASK_UPDATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-update.js');

    // Create and resolve task
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
      status: 'resolved'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Try to delete resolved task
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('EXECUTION phase');
  });

  test('warns when deleting task with dependents', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create base task
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Base task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Create dependent task
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '2',
      title: 'Dependent task',
      'blocked-by': '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Try to delete base task without force
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('depend on');
    expect(result.stderr).toContain('--force');
  });

  test('force deletes task with dependents', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create base task
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Base task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Create dependent task
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '2',
      title: 'Dependent task',
      'blocked-by': '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Force delete base task
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      force: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('deleted');
    expect(result.json.orphaned_dependencies).toContain('2');

    // Verify task is actually deleted
    const taskFile = path.join(mock.tasksDir, '1.json');
    expect(fs.existsSync(taskFile)).toBe(false);
  });

  test('deletes open task without warning when no dependents', () => {
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
    expect(result.stdout).toContain('deleted');
    expect(result.json.orphaned_dependencies).toEqual([]);
  });
});
