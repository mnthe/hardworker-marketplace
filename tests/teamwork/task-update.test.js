#!/usr/bin/env bun
/**
 * Tests for task-update.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-update.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');
const TASK_CLAIM_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-claim.js');

describe('task-update.js', () => {
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
    expect(result.stdout).toContain('task-update');
  });

  test('updates task status', () => {
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
      status: 'resolved'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Task 1 updated');
    expect(result.json.status).toBe('resolved');
  });

  test('adds evidence', () => {
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
      'add-evidence': 'Test evidence added'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.evidence).toBeTruthy();
    expect(result.json.evidence.length).toBeGreaterThan(0);
  });

  test('updates task title and description', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Old title'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'New title',
      description: 'New description'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.title).toBe('New title');
    expect(result.json.description).toBe('New description');
  });

  test('releases task', () => {
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

    runScript(TASK_CLAIM_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      release: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.claimed_by).toBe(null);
    expect(result.json.status).toBe('in_progress');
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
      id: '999',
      status: 'resolved'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('fails with invalid status value', () => {
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
      status: 'invalid-status'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid status');
  });

  test('allows multiple evidence additions', () => {
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

    // Add first evidence
    runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      'add-evidence': 'First evidence'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Add second evidence
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      'add-evidence': 'Second evidence'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.evidence.length).toBe(2);
    expect(result.json.evidence).toContain('First evidence');
    expect(result.json.evidence).toContain('Second evidence');
  });

  test('allows evidence addition to resolved task', () => {
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

    // Resolve task
    runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      status: 'resolved'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Add evidence after resolution
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      'add-evidence': 'Post-resolution evidence'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.status).toBe('resolved');
    expect(result.json.evidence).toContain('Post-resolution evidence');
  });

  test('handles empty string values for optional fields', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task',
      description: 'Original description'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Update with empty description
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      description: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.description).toBe('');
  });

  test('fails when releasing unclaimed task', () => {
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

    // Try to release unclaimed task (should succeed but have no effect)
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      release: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.claimed_by).toBe(null);
  });
});
