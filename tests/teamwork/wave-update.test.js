#!/usr/bin/env bun
/**
 * Tests for wave-update.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, mockProject } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/wave-update.js');
const WAVE_CALC_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/wave-calculate.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

describe('wave-update.js', () => {
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
    expect(result.stdout).toContain('wave-update');
  });

  test('updates wave status', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create tasks and calculate waves
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task 1'
    });

    runScript(WAVE_CALC_PATH, {
      project: 'test-project',
      team: 'test-team'
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'in_progress'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Wave 1');
    expect(result.json.waves[0].status).toBe('in_progress');
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails with invalid wave ID', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task 1'
    });

    runScript(WAVE_CALC_PATH, {
      project: 'test-project',
      team: 'test-team'
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '999',
      status: 'in_progress'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('validates status values', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task 1'
    });

    runScript(WAVE_CALC_PATH, {
      project: 'test-project',
      team: 'test-team'
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'invalid'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid status');
  });

  test('updates wave timestamps', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task 1'
    });

    runScript(WAVE_CALC_PATH, {
      project: 'test-project',
      team: 'test-team'
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'verified'
    });

    expect(result.exitCode).toBe(0);
    // Find wave 1 and check verified_at
    const wave1 = result.json.waves.find(w => w.id === 1);
    expect(wave1.verified_at).toBeTruthy();
  });
});
