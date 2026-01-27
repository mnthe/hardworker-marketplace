#!/usr/bin/env bun
/**
 * Tests for wave-update.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
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
      wave: '1',
      status: 'in_progress'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Wave 1');
    expect(result.json.waves[0].status).toBe('in_progress');
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

  test('fails with invalid wave ID', () => {
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
      wave: '999',
      status: 'in_progress'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
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
      wave: '1',
      status: 'invalid'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
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
      wave: '1',
      status: 'verified'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    // Find wave 1 and check verified_at
    const wave1 = result.json.waves.find(w => w.id === 1);
    expect(wave1.verified_at).toBeTruthy();
  });

  test('allows backward status transition', () => {
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

    // First update to verified
    runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'verified'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Then update back to in_progress (backward transition)
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'in_progress'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    const wave1 = result.json.waves.find(w => w.id === 1);
    expect(wave1.status).toBe('in_progress');
  });

  test('handles wave with empty tasks', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create waves.json with wave containing no tasks
    const wavesFile = path.join(mock.projectDir, 'waves.json');
    const wavesData = {
      version: '1.0',
      total_waves: 1,
      current_wave: 1,
      waves: [
        {
          id: 1,
          status: 'planning',
          tasks: [],
          started_at: null,
          completed_at: null,
          verified_at: null
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fs.writeFileSync(wavesFile, JSON.stringify(wavesData, null, 2), 'utf-8');

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'in_progress'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    const wave1 = result.json.waves.find(w => w.id === 1);
    expect(wave1.status).toBe('in_progress');
    expect(wave1.tasks).toEqual([]);
  });

  test('sets started_at only on first in_progress transition', () => {
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

    // First transition to in_progress
    const result1 = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'in_progress'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result1.exitCode).toBe(0);
    const wave1_first = result1.json.waves.find(w => w.id === 1);
    const firstStartedAt = wave1_first.started_at;
    expect(firstStartedAt).toBeTruthy();

    // Update to completed then back to in_progress
    runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'completed'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result2 = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '1',
      status: 'in_progress'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result2.exitCode).toBe(0);
    const wave1_second = result2.json.waves.find(w => w.id === 1);
    // started_at should not change
    expect(wave1_second.started_at).toBe(firstStartedAt);
  });

  test('updates current_wave when transitioning to in_progress', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create multiple tasks
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
      title: 'Task 2',
      'blocked-by': '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(WAVE_CALC_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Update wave 2 to in_progress
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      wave: '2',
      status: 'in_progress'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.current_wave).toBe(2);
  });
});
