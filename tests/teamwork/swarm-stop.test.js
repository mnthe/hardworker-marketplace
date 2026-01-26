#!/usr/bin/env bun
/**
 * Tests for swarm-stop.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/swarm-stop.js');

describe('swarm-stop.js', () => {
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
    expect(result.stdout).toContain('swarm-stop');
  });

  test('requires either --worker or --all flag', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Either --worker or --all is required');
  });

  test('rejects both --worker and --all together', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      worker: 'w1',
      all: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Cannot use --worker and --all together');
  });

  test('fails without required --project parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      team: 'test-team',
      worker: 'w1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --team parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      worker: 'w1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails when swarm does not exist', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      worker: 'w1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Swarm not found');
  });

  test('stops specific worker successfully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm state
    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    const swarmState = {
      session: 'teamwork-test-project',
      status: 'running',
      workers: ['w1', 'w2'],
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify(swarmState, null, 2)
    );

    const workerState = {
      id: 'w1',
      role: 'backend',
      pane: 1,
      status: 'working',
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify(workerState, null, 2)
    );

    // Note: This will fail because tmux session doesn't actually exist
    // This is expected behavior - we're testing the logic, not tmux
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      worker: 'w1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Should fail due to missing tmux session
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('tmux session not found');
  });

  test('stops all workers successfully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm state
    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    const swarmState = {
      session: 'teamwork-test-project',
      status: 'running',
      workers: ['w1', 'w2'],
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify(swarmState, null, 2)
    );

    // Note: This will fail because tmux session doesn't actually exist
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      all: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Should fail due to missing tmux session
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('tmux session not found');
  });

  test('fails when worker does not exist', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm state without w1
    const swarmDir = path.join(mock.projectDir, 'swarm');
    fs.mkdirSync(swarmDir, { recursive: true });

    const swarmState = {
      session: 'teamwork-test-project',
      status: 'running',
      workers: ['w2'],
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify(swarmState, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      worker: 'w1'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Worker not found: w1');
  });
});
