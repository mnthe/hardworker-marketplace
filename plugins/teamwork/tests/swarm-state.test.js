#!/usr/bin/env bun
/**
 * Tests for swarm state management library
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the library to test
const swarmState = require('../src/lib/swarm-state.js');

describe('swarm-state', () => {
  let testDir;
  let project;
  let team;

  beforeEach(() => {
    // Create isolated test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-test-'));

    // Override base directory for tests
    process.env.TEAMWORK_TEST_BASE_DIR = testDir;

    project = 'test-project';
    team = 'test-team';

    // Create project directory structure
    const projectDir = path.join(testDir, project, team);
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.TEAMWORK_TEST_BASE_DIR;
  });

  describe('createSwarmState', () => {
    test('creates swarm.json with correct structure', () => {
      const data = {
        session: 'teamwork-my-app',
        status: 'running',
        workers: ['w1', 'w2'],
        current_wave: 1,
        paused: false,
        use_worktree: true,
        source_dir: '/path/to/project'
      };

      swarmState.createSwarmState(project, team, data);

      const swarmFile = path.join(testDir, project, team, 'swarm', 'swarm.json');
      expect(fs.existsSync(swarmFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(swarmFile, 'utf-8'));
      expect(content.session).toBe('teamwork-my-app');
      expect(content.status).toBe('running');
      expect(content.workers).toEqual(['w1', 'w2']);
      expect(content.created_at).toBeDefined();
    });

    test('creates swarm directory if it does not exist', () => {
      const data = {
        session: 'test-session',
        status: 'running',
        workers: [],
        use_worktree: false,
        source_dir: '/test'
      };

      swarmState.createSwarmState(project, team, data);

      const swarmDir = path.join(testDir, project, team, 'swarm');
      expect(fs.existsSync(swarmDir)).toBe(true);
    });
  });

  describe('getSwarmState', () => {
    test('reads existing swarm.json', () => {
      // Create swarm state first
      const data = {
        session: 'test-session',
        status: 'running',
        workers: ['w1'],
        use_worktree: false,
        source_dir: '/test'
      };
      swarmState.createSwarmState(project, team, data);

      // Now read it back
      const state = swarmState.getSwarmState(project, team);
      expect(state.session).toBe('test-session');
      expect(state.status).toBe('running');
    });

    test('throws error if swarm.json does not exist', () => {
      expect(() => {
        swarmState.getSwarmState(project, team);
      }).toThrow();
    });
  });

  describe('updateSwarmState', () => {
    test('updates existing swarm.json fields', () => {
      // Create initial state
      const data = {
        session: 'test-session',
        status: 'running',
        workers: ['w1'],
        use_worktree: false,
        source_dir: '/test'
      };
      swarmState.createSwarmState(project, team, data);

      // Update status
      swarmState.updateSwarmState(project, team, { status: 'stopped' });

      // Verify update
      const state = swarmState.getSwarmState(project, team);
      expect(state.status).toBe('stopped');
      expect(state.session).toBe('test-session'); // Other fields unchanged
    });
  });

  describe('createWorkerState', () => {
    test('creates worker state file with correct structure', () => {
      const workerId = 'w1';
      const data = {
        id: workerId,
        role: 'backend',
        pane: 0,
        worktree: null,
        branch: null,
        status: 'idle',
        current_task: null,
        tasks_completed: [],
        last_heartbeat: new Date().toISOString()
      };

      swarmState.createWorkerState(project, team, workerId, data);

      const workerFile = path.join(testDir, project, team, 'swarm', 'workers', `${workerId}.json`);
      expect(fs.existsSync(workerFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(workerFile, 'utf-8'));
      expect(content.id).toBe('w1');
      expect(content.role).toBe('backend');
      expect(content.status).toBe('idle');
    });

    test('creates workers directory if it does not exist', () => {
      const workerId = 'w1';
      const data = {
        id: workerId,
        role: 'frontend',
        pane: 0,
        status: 'idle',
        tasks_completed: []
      };

      swarmState.createWorkerState(project, team, workerId, data);

      const workersDir = path.join(testDir, project, team, 'swarm', 'workers');
      expect(fs.existsSync(workersDir)).toBe(true);
    });
  });

  describe('getWorkerState', () => {
    test('reads existing worker state', () => {
      const workerId = 'w1';
      const data = {
        id: workerId,
        role: 'backend',
        pane: 0,
        status: 'idle',
        tasks_completed: []
      };
      swarmState.createWorkerState(project, team, workerId, data);

      const state = swarmState.getWorkerState(project, team, workerId);
      expect(state.id).toBe('w1');
      expect(state.role).toBe('backend');
    });

    test('throws error if worker does not exist', () => {
      expect(() => {
        swarmState.getWorkerState(project, team, 'nonexistent');
      }).toThrow();
    });
  });

  describe('updateWorkerState', () => {
    test('updates existing worker fields', () => {
      const workerId = 'w1';
      const data = {
        id: workerId,
        role: 'backend',
        pane: 0,
        status: 'idle',
        tasks_completed: []
      };
      swarmState.createWorkerState(project, team, workerId, data);

      // Update status
      swarmState.updateWorkerState(project, team, workerId, { status: 'working' });

      // Verify update
      const state = swarmState.getWorkerState(project, team, workerId);
      expect(state.status).toBe('working');
      expect(state.role).toBe('backend'); // Other fields unchanged
    });
  });

  describe('getAllWorkerStates', () => {
    test('returns all worker states', () => {
      // Create multiple workers
      swarmState.createWorkerState(project, team, 'w1', {
        id: 'w1',
        role: 'backend',
        status: 'idle',
        tasks_completed: []
      });
      swarmState.createWorkerState(project, team, 'w2', {
        id: 'w2',
        role: 'frontend',
        status: 'working',
        tasks_completed: []
      });

      const workers = swarmState.getAllWorkerStates(project, team);
      expect(workers.length).toBe(2);
      expect(workers.find(w => w.id === 'w1')).toBeDefined();
      expect(workers.find(w => w.id === 'w2')).toBeDefined();
    });

    test('returns empty array if no workers exist', () => {
      const workers = swarmState.getAllWorkerStates(project, team);
      expect(workers).toEqual([]);
    });
  });

  describe('updateHeartbeat', () => {
    test('updates worker heartbeat timestamp', () => {
      const workerId = 'w1';
      const data = {
        id: workerId,
        role: 'backend',
        status: 'idle',
        tasks_completed: [],
        last_heartbeat: '2026-01-01T00:00:00Z'
      };
      swarmState.createWorkerState(project, team, workerId, data);

      // Wait a bit to ensure timestamp changes
      const beforeUpdate = new Date().toISOString();

      // Update heartbeat
      swarmState.updateHeartbeat(project, team, workerId);

      // Verify heartbeat was updated
      const state = swarmState.getWorkerState(project, team, workerId);
      expect(state.last_heartbeat).not.toBe('2026-01-01T00:00:00Z');
      expect(new Date(state.last_heartbeat).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeUpdate).getTime()
      );
    });
  });
});
