#!/usr/bin/env bun
/**
 * Tests for task-create.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

describe('task-create.js', () => {
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
    expect(result.stdout).toContain('task-create');
  });

  test('creates task with valid parameters', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task',
      description: 'Task description',
      role: 'backend'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Task 1 created');
    expect(result.json).toBeTruthy();

    assertJsonSchema(result.json, {
      id: 'string',
      title: 'string',
      description: 'string',
      role: 'string',
      complexity: 'string',
      status: 'string',
      blocked_by: 'array',
      version: 'number',
      created_at: 'string',
      updated_at: 'string',
      evidence: 'array'
    });

    expect(result.json.id).toBe('1');
    expect(result.json.title).toBe('Test task');
    expect(result.json.status).toBe('open');
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails if task already exists', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create task first time
    runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Try to create again
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('already exists');
  });

  test('parses blocked_by as comma-separated list', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '3',
      title: 'Dependent task',
      'blocked-by': '1,2'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.blocked_by).toEqual(['1', '2']);
  });

  test('defaults to standard complexity', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.complexity).toBe('standard');
  });

  test('validates complexity values', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task',
      complexity: 'invalid'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid complexity');
  });

  test('handles blocked_by with non-existent task IDs', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create task with blocked_by referencing non-existent tasks
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '3',
      title: 'Dependent task',
      'blocked-by': '999,888'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Should succeed (validation happens at claim time, not create time)
    expect(result.exitCode).toBe(0);
    expect(result.json.blocked_by).toEqual(['999', '888']);
  });

  test('creates task without optional description', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.description).toBe('Test task'); // defaults to title
  });

  test('validates domain values', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task',
      domain: 'invalid-domain'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid domain');
  });

  test('creates task with valid domain', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Security task',
      domain: 'security'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.domain).toBe('security');
  });
});
