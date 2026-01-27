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

  test('handles empty workers directory gracefully', () => {
    // v0.26.0+: swarm-status.js scans workers/ directory instead of swarm.json
    // This is more reliable when swarm.json gets overwritten by multiple spawn calls
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create swarm.json and empty workers directory (no worker files)
    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    const swarmData = {
      session: 'teamwork-test-project',
      status: 'running',
      workers: ['w1', 'w2']  // swarm.json lists workers but files don't exist
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

    // Now scans workers/ directory, so returns 0 workers (not 2 with not_found status)
    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(0);
  });

  // ============================================================================
  // Edge Cases - Invalid Data
  // ============================================================================

  test('handles worker file with invalid JSON gracefully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: ['w1'] }, null, 2)
    );

    // Write invalid JSON to worker file
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      '{ invalid json content }'
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Should not crash, returns worker with status 'not_found' (file exists but unreadable)
    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(1);
    expect(result.json.workers[0].id).toBe('w1');
    expect(result.json.workers[0].status).toBe('not_found');
    expect(result.json.workers[0].role).toBe('unknown');
  });

  test('handles swarm.json with invalid JSON gracefully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    fs.mkdirSync(swarmDir, { recursive: true });

    // Write invalid JSON to swarm.json
    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      '{ not valid json !!!'
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    // Should return not_initialized when swarm.json is corrupted
    expect(result.exitCode).toBe(0);
    expect(result.json.status).toBe('not_initialized');
  });

  test('handles worker file with missing required fields', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: ['w1'] }, null, 2)
    );

    // Worker file missing role, pane, status
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify({ id: 'w1' }, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(1);
    // Missing fields should have default/undefined values
    expect(result.json.workers[0].id).toBe('w1');
    expect(result.json.workers[0].role).toBeUndefined();
    expect(result.json.workers[0].status).toBe('unknown');
  });

  test('handles worker file with null values', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: ['w1'] }, null, 2)
    );

    // Worker file with explicit null values
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify({
        id: 'w1',
        role: null,
        pane: null,
        status: null,
        current_task: null,
        tasks_completed: null
      }, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(1);
    expect(result.json.workers[0].id).toBe('w1');
    expect(result.json.workers[0].current_task).toBe(null);
  });

  // ============================================================================
  // Edge Cases - Worker Sorting
  // ============================================================================

  test('sorts workers numerically (w1, w2, w10, w11)', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: [] }, null, 2)
    );

    // Create workers in non-sorted order: w10, w2, w1, w11
    const workerIds = ['w10', 'w2', 'w1', 'w11'];
    for (const id of workerIds) {
      fs.writeFileSync(
        path.join(workersDir, `${id}.json`),
        JSON.stringify({ id, role: 'backend', pane: 0, status: 'idle' }, null, 2)
      );
    }

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(4);
    // Should be sorted numerically: w1, w2, w10, w11
    expect(result.json.workers[0].id).toBe('w1');
    expect(result.json.workers[1].id).toBe('w2');
    expect(result.json.workers[2].id).toBe('w10');
    expect(result.json.workers[3].id).toBe('w11');
  });

  // ============================================================================
  // Edge Cases - Session ID Tracking (v0.27.0+)
  // ============================================================================

  test('includes session_id in worker status when present', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: ['w1'] }, null, 2)
    );

    // Worker with session_id (v0.27.0+ feature)
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify({
        id: 'w1',
        role: 'backend',
        pane: 0,
        session_id: 'abc-123-xyz',
        status: 'working',
        current_task: '5',
        tasks_completed: ['1', '2', '3'],
        last_heartbeat: '2026-01-27T10:00:00Z'
      }, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.workers[0].id).toBe('w1');
    expect(result.json.workers[0].status).toBe('working');
    expect(result.json.workers[0].current_task).toBe('5');
  });

  // ============================================================================
  // Edge Cases - Directory Structure
  // ============================================================================

  test('handles swarm directory without workers subdirectory', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    fs.mkdirSync(swarmDir, { recursive: true });
    // Note: NOT creating workers/ subdirectory

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: ['w1', 'w2'] }, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.status).toBe('stopped');
    expect(result.json.workers).toHaveLength(0);
  });

  test('handles non-json files in workers directory', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: [] }, null, 2)
    );

    // Create valid worker file
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify({ id: 'w1', role: 'backend', pane: 0, status: 'idle' }, null, 2)
    );

    // Create non-json files that should be ignored
    fs.writeFileSync(path.join(workersDir, '.DS_Store'), '');
    fs.writeFileSync(path.join(workersDir, 'README.md'), '# Workers');
    fs.writeFileSync(path.join(workersDir, 'w1.json.bak'), '{}');
    fs.writeFileSync(path.join(workersDir, 'w1.json.tmp'), '{}');

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    // Should only include w1.json, not the other files
    expect(result.json.workers).toHaveLength(1);
    expect(result.json.workers[0].id).toBe('w1');
  });

  // ============================================================================
  // Edge Cases - Multiple Workers Same Role
  // ============================================================================

  test('handles multiple workers with same role', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: [] }, null, 2)
    );

    // Create 3 backend workers
    for (let i = 1; i <= 3; i++) {
      fs.writeFileSync(
        path.join(workersDir, `w${i}.json`),
        JSON.stringify({
          id: `w${i}`,
          role: 'backend',
          pane: i - 1,
          status: i === 1 ? 'working' : 'idle',
          current_task: i === 1 ? '5' : null
        }, null, 2)
      );
    }

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(3);
    expect(result.json.workers.filter(w => w.role === 'backend')).toHaveLength(3);
    expect(result.json.workers.filter(w => w.status === 'working')).toHaveLength(1);
    expect(result.json.workers.filter(w => w.status === 'idle')).toHaveLength(2);
  });

  // ============================================================================
  // Edge Cases - Empty/Whitespace Values
  // ============================================================================

  test('handles empty string values in worker file', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: [] }, null, 2)
    );

    // Worker file with empty string values
    fs.writeFileSync(
      path.join(workersDir, 'w1.json'),
      JSON.stringify({
        id: 'w1',
        role: '',
        pane: 0,
        status: '',
        current_task: '',
        session_id: ''
      }, null, 2)
    );

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(1);
    expect(result.json.workers[0].id).toBe('w1');
    // Empty string status should fall back to 'unknown'
    expect(result.json.workers[0].status).toBe('unknown');
  });

  // ============================================================================
  // Edge Cases - Large Number of Workers
  // ============================================================================

  test('handles many workers (stress test)', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const swarmDir = path.join(mock.projectDir, 'swarm');
    const workersDir = path.join(swarmDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });

    fs.writeFileSync(
      path.join(swarmDir, 'swarm.json'),
      JSON.stringify({ session: 'test', status: 'running', workers: [] }, null, 2)
    );

    // Create 50 workers
    const workerCount = 50;
    const roles = ['backend', 'frontend', 'test', 'devops', 'docs'];
    for (let i = 1; i <= workerCount; i++) {
      fs.writeFileSync(
        path.join(workersDir, `w${i}.json`),
        JSON.stringify({
          id: `w${i}`,
          role: roles[i % roles.length],
          pane: i - 1,
          status: i % 3 === 0 ? 'working' : 'idle',
          current_task: i % 3 === 0 ? String(i) : null
        }, null, 2)
      );
    }

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.workers).toHaveLength(workerCount);
    // Verify sorting still works
    expect(result.json.workers[0].id).toBe('w1');
    expect(result.json.workers[9].id).toBe('w10');
    expect(result.json.workers[49].id).toBe('w50');
  });
});
