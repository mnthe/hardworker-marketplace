#!/usr/bin/env bun
/**
 * Tests for worker-setup.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/worker-setup.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

// Helper to run script with tmpdir as HOME
function runWorkerSetup(params) {
  return runScript(SCRIPT_PATH, params, {
    env: { ...process.env, HOME: os.tmpdir() }
  });
}

function createTask(params) {
  return runScript(TASK_CREATE_PATH, params, {
    env: { ...process.env, HOME: os.tmpdir() }
  });
}

describe('worker-setup.js', () => {
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
    expect(result.stdout).toContain('worker-setup');
  });

  test('sets up worker context with open tasks', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create an open task
    createTask({
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task',
      role: 'backend'
    });

    const result = runWorkerSetup({
      project: 'test-project',
      team: 'test-team',
      role: 'backend'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TEAMWORK WORKER READY');
    expect(result.stdout).toContain('test-project');
    expect(result.stdout).toContain('test-team');
  });

  test('exits with error when no open tasks', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runWorkerSetup({
      project: 'test-project',
      team: 'test-team',
      role: 'backend'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No open tasks');
  });

  test('fails with non-existent project', () => {
    const result = runWorkerSetup({
      project: 'non-existent',
      team: 'non-existent',
      role: 'backend'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No teamwork project found');
  });

  test('works without role filter', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create an open task
    createTask({
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task'
    });

    const result = runWorkerSetup({
      project: 'test-project',
      team: 'test-team'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Role filter: any');
  });

  test('validates role values', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create open tasks for each role
    const validRoles = ['frontend', 'backend'];

    for (const role of validRoles) {
      createTask({
        project: 'test-project',
        team: 'test-team',
        id: role,
        title: `Task for ${role}`,
        role: role
      });

      const result = runWorkerSetup({
        project: 'test-project',
        team: 'test-team',
        role: role
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Role filter: ${role}`);
    }
  });

  test('includes directory paths in output', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create an open task
    createTask({
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Test task',
      role: 'backend'
    });

    const result = runWorkerSetup({
      project: 'test-project',
      team: 'test-team',
      role: 'backend'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TEAMWORK_DIR=');
    expect(result.stdout).toContain('test-project');
  });
});
