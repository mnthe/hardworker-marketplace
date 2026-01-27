#!/usr/bin/env bun
/**
 * Tests for task-claim.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-claim.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

describe('task-claim.js', () => {
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
    expect(result.stdout).toContain('task-claim');
  });

  test('claims task successfully', () => {
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

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Task 1 claimed');
    expect(result.json).toBeTruthy();

    assertJsonSchema(result.json, {
      id: 'string',
      status: 'string',
      claimed_by: 'string'
    });

    expect(result.json.claimed_by).toBe('session-123');
    expect(result.json.status).toBe('in_progress');
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
      id: '999',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('fails if task already claimed', () => {
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

    // First claim
    runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Second claim attempt
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-456'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('already claimed');
  });

  test('allows reclaim by same owner', () => {
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

    // First claim
    runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Reclaim by same owner
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.claimed_by).toBe('session-123');
  });

  test('fails when trying to claim resolved task', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create and resolve task
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const TASK_UPDATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-update.js');
    runScript(TASK_UPDATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      status: 'resolved'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Try to claim resolved task
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not in a claimable status');
  });

  test('fails with role mismatch when using strict-role flag', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create task with frontend role
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Frontend task',
      role: 'frontend'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Try to claim with backend role and strict-role flag
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123',
      role: 'backend',
      'strict-role': ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('role mismatch');
  });

  test('allows claim with matching role when using strict-role flag', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create task with backend role
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Backend task',
      role: 'backend'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Claim with matching role and strict-role flag
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123',
      role: 'backend',
      'strict-role': ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.claimed_by).toBe('session-123');
  });

  test('handles version conflicts gracefully', () => {
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

    // Normal claim should succeed (version conflicts are handled internally with retries)
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.version).toBeGreaterThan(0);
  });

  test('claims task and updates claimed_at timestamp', () => {
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

    const beforeClaim = new Date().toISOString();

    // Claim task
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.claimed_at).toBeTruthy();
    // claimed_at should be after beforeClaim
    expect(new Date(result.json.claimed_at).getTime()).toBeGreaterThanOrEqual(new Date(beforeClaim).getTime());
  });

  test('allows claim after task is released by previous owner', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const TASK_UPDATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-update.js');

    // Create task
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // First worker claims task
    runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-123'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // First worker releases task
    runScript(TASK_UPDATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      release: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Second worker claims released task
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      owner: 'session-456'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.claimed_by).toBe('session-456');
    expect(result.json.status).toBe('in_progress');
  });
});
