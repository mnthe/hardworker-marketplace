#!/usr/bin/env bun
/**
 * Tests for fixes applied on 2026-01-28
 *
 * Fix 1: swarm-spawn.js - Use single quotes for command to prevent shell interpretation
 * Fix 2: project-status.js - Filter active_workers to only in_progress tasks
 * Fix 3: swarm-status.js - Include pane command in output for monitoring
 * Fix 4: swarm-spawn.js - Reuse existing session name from swarm.json for consistency
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

// Test directory setup
let testDir;
let project;
let team;

const SCRIPTS_DIR = path.join(__dirname, '..', 'src', 'scripts');

/**
 * Run a script with arguments
 * @param {string} scriptName - Script filename
 * @param {Object} args - Key-value arguments
 * @param {Object} options - Additional options (env, cwd)
 * @returns {{stdout: string, stderr: string, exitCode: number}}
 */
function runScript(scriptName, args = {}, options = {}) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const argList = [];

  for (const [key, value] of Object.entries(args)) {
    if (value === true) {
      argList.push(`--${key}`);
    } else if (value !== false && value !== undefined) {
      argList.push(`--${key}`, String(value));
    }
  }

  const env = {
    ...process.env,
    TEAMWORK_TEST_BASE_DIR: testDir,
    ...options.env
  };

  const result = spawnSync('bun', [scriptPath, ...argList], {
    encoding: 'utf-8',
    env,
    cwd: options.cwd || process.cwd()
  });

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status
  };
}

/**
 * Create a mock project with tasks
 */
function createMockProject(options = {}) {
  const projectDir = path.join(testDir, project, team);
  const tasksDir = path.join(projectDir, 'tasks');
  const swarmDir = path.join(projectDir, 'swarm');
  const workersDir = path.join(swarmDir, 'workers');

  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(workersDir, { recursive: true });

  // Create project.json
  const projectData = {
    project: project,
    team: team,
    goal: 'Test project',
    phase: options.phase || 'EXECUTION',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: {
      total: 0,
      open: 0,
      in_progress: 0,
      resolved: 0
    }
  };
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(projectData, null, 2));

  return { projectDir, tasksDir, swarmDir, workersDir };
}

/**
 * Create a mock task
 */
function createMockTask(id, options = {}) {
  const tasksDir = path.join(testDir, project, team, 'tasks');

  const task = {
    id: String(id),
    title: options.title || `Task ${id}`,
    description: options.description || `Description for task ${id}`,
    role: options.role || 'backend',
    complexity: options.complexity || 'standard',
    status: options.status || 'open',
    blocked_by: options.blocked_by || [],
    wave: options.wave || 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    claimed_by: options.claimed_by || null,
    claimed_at: options.claimed_at || null,
    completed_at: options.completed_at || null,
    evidence: options.evidence || []
  };

  fs.writeFileSync(path.join(tasksDir, `${id}.json`), JSON.stringify(task, null, 2));
  return task;
}

/**
 * Create mock swarm state
 */
function createMockSwarmState(options = {}) {
  const swarmDir = path.join(testDir, project, team, 'swarm');

  if (!fs.existsSync(swarmDir)) {
    fs.mkdirSync(swarmDir, { recursive: true });
  }

  const swarmData = {
    session: options.session || `teamwork-${project}`,
    status: options.status || 'running',
    created_at: new Date().toISOString(),
    workers: options.workers || [],
    current_wave: options.current_wave || null,
    paused: options.paused || false,
    use_worktree: options.use_worktree || false,
    source_dir: options.source_dir || testDir
  };

  fs.writeFileSync(path.join(swarmDir, 'swarm.json'), JSON.stringify(swarmData, null, 2));
  return swarmData;
}

/**
 * Create mock worker state
 */
function createMockWorkerState(workerId, options = {}) {
  const workersDir = path.join(testDir, project, team, 'swarm', 'workers');

  if (!fs.existsSync(workersDir)) {
    fs.mkdirSync(workersDir, { recursive: true });
  }

  const workerData = {
    id: workerId,
    role: options.role || 'backend',
    pane: options.pane ?? 0,
    worktree: options.worktree || null,
    branch: options.branch || null,
    status: options.status || 'idle',
    current_task: options.current_task || null,
    tasks_completed: options.tasks_completed || [],
    last_heartbeat: new Date().toISOString()
  };

  fs.writeFileSync(path.join(workersDir, `${workerId}.json`), JSON.stringify(workerData, null, 2));
  return workerData;
}

describe('Fixes 2026-01-28', () => {
  beforeEach(() => {
    // Create isolated test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamwork-fixes-test-'));
    process.env.TEAMWORK_TEST_BASE_DIR = testDir;

    project = 'test-project';
    team = 'test-team';
  });

  afterEach(() => {
    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.TEAMWORK_TEST_BASE_DIR;
  });

  describe('Fix 1: swarm-spawn.js command quoting', () => {
    test('sendKeys uses single quotes for command', () => {
      // Read the swarm-spawn.js source to verify the fix
      const scriptPath = path.join(SCRIPTS_DIR, 'swarm-spawn.js');
      const content = fs.readFileSync(scriptPath, 'utf-8');

      // Verify single quotes are used around the worker command
      expect(content).toContain("'${workerCommand}'");
      expect(content).toContain("claude --dangerously-skip-permissions '");

      // Should NOT use double quotes that caused the bug
      expect(content).not.toContain('"${workerCommand}"');
    });

    test('worker command includes --worker-id for state tracking', () => {
      const scriptPath = path.join(SCRIPTS_DIR, 'swarm-spawn.js');
      const content = fs.readFileSync(scriptPath, 'utf-8');

      // Verify --worker-id is included in the command
      expect(content).toContain('--worker-id ${workerId}');
    });
  });

  describe('Fix 2: project-status.js active workers filter', () => {
    test('active_workers only includes in_progress tasks', () => {
      createMockProject();

      // Create tasks with different statuses
      createMockTask(1, {
        status: 'in_progress',
        claimed_by: 'session-1',
        claimed_at: new Date().toISOString()
      });
      createMockTask(2, {
        status: 'resolved',  // Should NOT be in active_workers
        claimed_by: 'session-2',
        claimed_at: new Date().toISOString()
      });
      createMockTask(3, {
        status: 'in_progress',
        claimed_by: 'session-3',
        claimed_at: new Date().toISOString()
      });
      createMockTask(4, { status: 'open' });

      const result = runScript('project-status.js', {
        project,
        team,
        format: 'json'
      });

      expect(result.exitCode).toBe(0);

      const status = JSON.parse(result.stdout);

      // Should have exactly 2 active workers (task 1 and 3)
      expect(status.stats.active_workers.length).toBe(2);

      // Verify only in_progress tasks are included
      const taskIds = status.stats.active_workers.map(w => w.task_id);
      expect(taskIds).toContain('1');
      expect(taskIds).toContain('3');
      expect(taskIds).not.toContain('2');  // resolved task
    });

    test('active_workers is empty when no in_progress tasks', () => {
      createMockProject();

      // Create only open and resolved tasks
      createMockTask(1, { status: 'open' });
      createMockTask(2, {
        status: 'resolved',
        claimed_by: 'session-2'
      });

      const result = runScript('project-status.js', {
        project,
        team,
        format: 'json'
      });

      expect(result.exitCode).toBe(0);

      const status = JSON.parse(result.stdout);
      expect(status.stats.active_workers.length).toBe(0);
    });
  });

  describe('Fix 3: swarm-status.js pane command field', () => {
    test('worker output includes command field', () => {
      createMockProject();
      createMockSwarmState({ workers: ['w1'] });
      createMockWorkerState('w1', { role: 'backend', pane: 0 });

      const result = runScript('swarm-status.js', {
        project,
        team,
        format: 'json'
      });

      expect(result.exitCode).toBe(0);

      const status = JSON.parse(result.stdout);

      // Each worker should have a command field
      expect(status.workers.length).toBe(1);
      expect(status.workers[0]).toHaveProperty('command');
    });

    test('getTmuxPaneStates function extracts command from pane', () => {
      // Read the swarm-status.js source to verify the fix
      const scriptPath = path.join(SCRIPTS_DIR, 'swarm-status.js');
      const content = fs.readFileSync(scriptPath, 'utf-8');

      // Verify pane_current_command is extracted
      expect(content).toContain('#{pane_current_command}');

      // Verify command is added to worker info
      expect(content).toContain('command: paneInfo.command');
    });

    test('table output includes Command column', () => {
      const scriptPath = path.join(SCRIPTS_DIR, 'swarm-status.js');
      const content = fs.readFileSync(scriptPath, 'utf-8');

      // Verify table header includes Command column
      expect(content).toContain('| Command');
    });
  });

  describe('Fix 4: swarm-spawn.js session name consistency', () => {
    test('reuses existing session name from swarm.json', () => {
      // Read the swarm-spawn.js source to verify the fix
      const scriptPath = path.join(SCRIPTS_DIR, 'swarm-spawn.js');
      const content = fs.readFileSync(scriptPath, 'utf-8');

      // Verify the session name lookup from swarm.json
      expect(content).toContain('existingSwarmFile');
      expect(content).toContain('existingSwarm.session');
    });

    test('swarm.json lookup precedes default session name', () => {
      const scriptPath = path.join(SCRIPTS_DIR, 'swarm-spawn.js');
      const content = fs.readFileSync(scriptPath, 'utf-8');

      // Verify the order: check swarm.json first, then use default
      // The pattern should be: if not from args, check swarm.json, then default
      const checkExisting = content.indexOf('existingSwarmFile');
      const defaultFallback = content.indexOf('teamwork-${args.project}');

      // Existing check should come before the default fallback
      expect(checkExisting).toBeLessThan(defaultFallback);
    });
  });

  describe('Fix 5: graceful shutdown via swarm-stop.js --graceful', () => {
    test('sets shutdown_requested flag in swarm.json', () => {
      createMockProject();
      createMockSwarmState({ workers: ['w1', 'w2'] });
      createMockWorkerState('w1', { role: 'backend' });
      createMockWorkerState('w2', { role: 'frontend' });

      const result = runScript('swarm-stop.js', {
        project,
        team,
        graceful: true
      });

      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.action).toBe('graceful_shutdown_requested');

      // Verify swarm.json has shutdown_requested flag
      const swarmFile = path.join(testDir, project, team, 'swarm', 'swarm.json');
      const swarmData = JSON.parse(fs.readFileSync(swarmFile, 'utf-8'));
      expect(swarmData.shutdown_requested).toBe(true);
      expect(swarmData.shutdown_requested_at).toBeDefined();
    });

    test('workers array preserved during graceful shutdown', () => {
      createMockProject();
      createMockSwarmState({ workers: ['w1', 'w2', 'w3'] });

      const result = runScript('swarm-stop.js', {
        project,
        team,
        graceful: true
      });

      expect(result.exitCode).toBe(0);

      // Verify workers are NOT removed (unlike --all which removes them)
      const swarmFile = path.join(testDir, project, team, 'swarm', 'swarm.json');
      const swarmData = JSON.parse(fs.readFileSync(swarmFile, 'utf-8'));
      expect(swarmData.workers).toContain('w1');
      expect(swarmData.workers).toContain('w2');
      expect(swarmData.workers).toContain('w3');
    });
  });

  describe('Integration: active workers count matches actual in_progress', () => {
    test('dashboard shows correct worker count', () => {
      createMockProject();

      // Simulate real scenario: 5 workers spawned, 2 actively working
      // Other tasks resolved with historical claimed_by
      createMockTask(1, {
        status: 'resolved',
        claimed_by: 'session-1'
      });
      createMockTask(2, {
        status: 'resolved',
        claimed_by: 'session-2'
      });
      createMockTask(3, {
        status: 'in_progress',
        claimed_by: 'session-3',
        claimed_at: new Date().toISOString()
      });
      createMockTask(4, {
        status: 'resolved',
        claimed_by: 'session-4'
      });
      createMockTask(5, {
        status: 'in_progress',
        claimed_by: 'session-5',
        claimed_at: new Date().toISOString()
      });

      const result = runScript('project-status.js', {
        project,
        team,
        format: 'json'
      });

      expect(result.exitCode).toBe(0);

      const status = JSON.parse(result.stdout);

      // Bug: was showing 5 active workers (all claimed_by)
      // Fix: should show 2 active workers (only in_progress)
      expect(status.stats.active_workers.length).toBe(2);
      expect(status.stats.in_progress).toBe(2);
      expect(status.stats.resolved).toBe(3);
    });
  });
});
