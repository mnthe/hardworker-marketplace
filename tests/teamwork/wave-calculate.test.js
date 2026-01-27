#!/usr/bin/env bun
/**
 * Tests for wave-calculate.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/wave-calculate.js');
const TASK_CREATE_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/task-create.js');

describe('wave-calculate.js', () => {
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
    expect(result.stdout).toContain('wave-calculate');
  });

  test('calculates waves from task dependencies', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create tasks with dependencies
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

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Calculated');
    expect(result.json).toBeTruthy();

    assertJsonSchema(result.json, {
      version: 'string',
      total_waves: 'number',
      current_wave: 'number',
      waves: 'array'
    });
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

  test('handles project with no tasks', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No tasks found');
  });

  test('creates waves.json file', () => {
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
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);

    const wavesFile = path.join(mock.projectDir, 'waves.json');
    expect(fs.existsSync(wavesFile)).toBe(true);
  });

  test('groups independent tasks in same wave', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create independent tasks
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
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.total_waves).toBe(1);
    expect(result.json.waves[0].tasks.length).toBe(2);
  });

  test('detects circular dependency (A blocks B, B blocks A)', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create tasks with circular dependency
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task 1',
      'blocked-by': '2'
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

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Circular dependency');
  });

  test('handles diamond dependency (A→B, A→C, B→D, C→D)', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create diamond dependency structure
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task A'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '2',
      title: 'Task B',
      'blocked-by': '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '3',
      title: 'Task C',
      'blocked-by': '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '4',
      title: 'Task D',
      'blocked-by': '2,3'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.total_waves).toBe(3);
    expect(result.json.waves[0].tasks).toContain('1');
    expect(result.json.waves[1].tasks).toContain('2');
    expect(result.json.waves[1].tasks).toContain('3');
    expect(result.json.waves[2].tasks).toContain('4');
  });

  test('rejects self-referencing blocked_by', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create task that blocks itself
    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Task 1',
      'blocked-by': '1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Circular dependency');
  });

  test('handles deep dependency chain (10+ levels)', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create chain: 1 -> 2 -> 3 -> ... -> 12
    for (let i = 1; i <= 12; i++) {
      const blockedBy = i > 1 ? String(i - 1) : undefined;
      runScript(TASK_CREATE_PATH, {
        project: 'test-project',
        team: 'test-team',
        id: String(i),
        title: `Task ${i}`,
        ...(blockedBy && { 'blocked-by': blockedBy })
      }, {
        env: { ...process.env, HOME: os.tmpdir() }
      });
    }

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.total_waves).toBe(12);
    // Verify sequential wave assignment
    for (let i = 0; i < 12; i++) {
      expect(result.json.waves[i].tasks).toContain(String(i + 1));
    }
  });

  test('handles single task', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    runScript(TASK_CREATE_PATH, {
      project: 'test-project',
      team: 'test-team',
      id: '1',
      title: 'Single Task'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.total_waves).toBe(1);
    expect(result.json.waves[0].tasks).toEqual(['1']);
  });
});
