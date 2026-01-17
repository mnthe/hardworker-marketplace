#!/usr/bin/env bun
/**
 * Tests for wave-status.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/wave-status.js');
const WAVE_CALC_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/wave-calculate.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

describe('wave-status.js', () => {
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
    expect(result.stdout).toContain('wave-status');
  });

  test('shows wave status in JSON format', () => {
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

    runScript(WAVE_CALC_PATH, {
      project: 'test-project',
      team: 'test-team'
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

    assertJsonSchema(result.json, {
      total_waves: 'number',
      current_wave: 'number',
      waves: 'array'
    });
  });

  test('shows wave status in table format', () => {
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

    runScript(WAVE_CALC_PATH, {
      project: 'test-project',
      team: 'test-team'
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
    expect(result.stdout).toContain('WAVE');
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

  test('handles project without waves gracefully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Script may return empty waves or create a minimal wave structure
    if (result.exitCode === 0) {
      expect(result.json).toBeTruthy();
      expect(result.json.total_waves).toBeDefined();
    } else {
      expect(result.stderr).toContain('waves');
    }
  });

  test('includes task details for each wave', () => {
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

    runScript(WAVE_CALC_PATH, {
      project: 'test-project',
      team: 'test-team'
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
    expect(result.json.waves[0].tasks).toBeTruthy();
    expect(result.json.waves[0].tasks.length).toBeGreaterThan(0);
  });
});
