#!/usr/bin/env bun
/**
 * Tests for swarm-status.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/swarm-status.js');

describe('swarm-status.js', () => {
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
    expect(result.stdout).toContain('swarm-status');
  });

  test('returns not_initialized status when no swarm exists', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.status).toBe('not_initialized');
    expect(result.json.workers).toEqual([]);
  });

  test('returns stopped status when swarm exists but tmux session does not', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm directory and swarm.json
    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(swarmDir, { recursive: true });
    fs.mkdirSync(workersDir, { recursive: true });

    const swarmData = {
      session: 'teamwork-test-project',
      status: 'running',
      workers: ['w1', 'w2']
    };
    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify(swarmData, null, 2)
    );

    // Create worker files
    const worker1 = {
      id: 'w1',
      role: 'backend',
      pane: 1,
      status: 'working',
      current_task: '3'
    };
    const worker2 = {
      id: 'w2',
      role: 'frontend',
      pane: 2,
      status: 'idle',
      current_task: null
    };
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify(worker1, null, 2)
    );
    fs.writeFileSync(
      path.join(workersDir, 'w2.json'),
      JSON.stringify(worker2, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.status).toBe('stopped');
    expect(result.json.session).toBe('teamwork-test-project');
    expect(result.json.workers).toHaveLength(2);

    // Workers should be marked as not alive since tmux session doesn't exist
    expect(result.json.workers[0].id).toBe('w1');
    expect(result.json.workers[0].role).toBe('backend');
    expect(result.json.workers[0].pane).toBe(1);
    expect(result.json.workers[0].alive).toBe(false);
    expect(result.json.workers[0].current_task).toBe('3');

    expect(result.json.workers[1].id).toBe('w2');
    expect(result.json.workers[1].role).toBe('frontend');
    expect(result.json.workers[1].alive).toBe(false);
    expect(result.json.workers[1].current_task).toBe(null);
  });

  test('outputs in table format', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm directory
    const swarmDir = path.join(mock.projectDir, 'swarm');
    fs.mkdirSync(swarmDir, { recursive: true });

    const swarmData = {
      session: 'teamwork-test-project',
      status: 'running',
      workers: []
    };
    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify(swarmData, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'table'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('SWARM STATUS');
    expect(result.stdout).toContain('teamwork-test-project');
  });

  test('validates JSON schema', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

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
      status: 'string',
      session: 'string|null',
      workers: 'array'
    });
  });

  test('fails without required project parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      team: 'test-team'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required team parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails with non-existent project', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'nonexistent',
      team: 'nonexistent'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('handles missing worker files gracefully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm.json but no worker files
    const swarmDir = path.join(mock.projectDir, 'swarm');
    fs.mkdirSync(swarmDir, { recursive: true });

    const swarmData = {
      session: 'teamwork-test-project',
      status: 'running',
      workers: ['w1', 'w2']
    };
    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify(swarmData, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(2);
    expect(result.json.workers[0].status).toBe('not_found');
    expect(result.json.workers[1].status).toBe('not_found');
  });
});
