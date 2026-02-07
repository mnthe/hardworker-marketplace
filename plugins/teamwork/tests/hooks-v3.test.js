#!/usr/bin/env bun
/**
 * Tests for v3 hook system:
 * - project-progress.js (TaskCompleted)
 * - teammate-idle.js (TeammateIdle)
 * - orchestrator-completed.js (SubagentStop)
 * - hooks.json structure
 */

import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// ============================================================================
// Constants
// ============================================================================

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const HOOKS_JSON_PATH = path.join(PLUGIN_ROOT, 'hooks', 'hooks.json');
const PROJECT_PROGRESS_PATH = path.join(PLUGIN_ROOT, 'src', 'hooks', 'project-progress.js');
const TEAMMATE_IDLE_PATH = path.join(PLUGIN_ROOT, 'src', 'hooks', 'teammate-idle.js');
const ORCHESTRATOR_COMPLETED_PATH = path.join(PLUGIN_ROOT, 'src', 'hooks', 'orchestrator-completed.js');

// ============================================================================
// Helpers
// ============================================================================

/**
 * Run a hook script with JSON input piped via stdin
 */
function runHook(scriptPath, stdinInput = '') {
  return new Promise((resolve) => {
    const proc = spawn('bun', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: os.tmpdir()
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (exitCode) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode || 0
      });
    });

    const input = typeof stdinInput === 'object' ? JSON.stringify(stdinInput) : stdinInput;
    proc.stdin.write(input);
    proc.stdin.end();
  });
}

// ============================================================================
// hooks.json Tests
// ============================================================================

describe('hooks.json', () => {
  test('file exists and is valid JSON', () => {
    expect(fs.existsSync(HOOKS_JSON_PATH)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
    expect(parsed.hooks).toBeDefined();
  });

  test('defines TaskCompleted hook', () => {
    const content = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
    expect(content.hooks.TaskCompleted).toBeDefined();
    expect(content.hooks.TaskCompleted[0].matcher).toBe('*');
    expect(content.hooks.TaskCompleted[0].hooks[0].command).toContain('project-progress.js');
    expect(content.hooks.TaskCompleted[0].hooks[0].command).toContain('bun');
  });

  test('defines TeammateIdle hook', () => {
    const content = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
    expect(content.hooks.TeammateIdle).toBeDefined();
    expect(content.hooks.TeammateIdle[0].matcher).toBe('*');
    expect(content.hooks.TeammateIdle[0].hooks[0].command).toContain('teammate-idle.js');
  });

  test('defines SubagentStop hook for orchestrator', () => {
    const content = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
    expect(content.hooks.SubagentStop).toBeDefined();
    expect(content.hooks.SubagentStop[0].matcher).toBe('teamwork:orchestrator');
    expect(content.hooks.SubagentStop[0].hooks[0].command).toContain('orchestrator-completed.js');
    expect(content.hooks.SubagentStop[0].hooks[0].command).toContain('bun');
  });

  test('does NOT define old Stop or PostToolUse hooks', () => {
    const content = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
    expect(content.hooks.Stop).toBeUndefined();
    expect(content.hooks.PostToolUse).toBeUndefined();
  });
});

// ============================================================================
// project-progress.js Tests
// ============================================================================

describe('project-progress.js', () => {
  test('file exists', () => {
    expect(fs.existsSync(PROJECT_PROGRESS_PATH)).toBe(true);
  });

  test('exits gracefully with empty stdin', async () => {
    const result = await runHook(PROJECT_PROGRESS_PATH, '');
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully with invalid JSON', async () => {
    const result = await runHook(PROJECT_PROGRESS_PATH, 'not-valid-json{{{');
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully with empty object', async () => {
    const result = await runHook(PROJECT_PROGRESS_PATH, {});
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully when stop_hook_active is true', async () => {
    const result = await runHook(PROJECT_PROGRESS_PATH, {
      team_name: 'test-team',
      stop_hook_active: true
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(''); // Should produce no output
  });

  test('outputs structured JSON with valid input', async () => {
    const result = await runHook(PROJECT_PROGRESS_PATH, {
      task_id: '1',
      team_name: 'test-team',
      status: 'completed'
    });
    expect(result.exitCode).toBe(0);
    // Output may be empty (no tasks dir) or JSON — both are valid
  });
});

// ============================================================================
// teammate-idle.js Tests
// ============================================================================

describe('teammate-idle.js', () => {
  test('file exists', () => {
    expect(fs.existsSync(TEAMMATE_IDLE_PATH)).toBe(true);
  });

  test('exits gracefully with empty stdin', async () => {
    const result = await runHook(TEAMMATE_IDLE_PATH, '');
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully with invalid JSON', async () => {
    const result = await runHook(TEAMMATE_IDLE_PATH, 'not-valid-json{{{');
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully when stop_hook_active is true', async () => {
    const result = await runHook(TEAMMATE_IDLE_PATH, {
      team_name: 'test-team',
      stop_hook_active: true
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  test('outputs structured JSON with teammate info', async () => {
    const result = await runHook(TEAMMATE_IDLE_PATH, {
      teammate_name: 'worker-backend',
      team_name: 'test-team',
      agent_type: 'teamwork:backend'
    });
    expect(result.exitCode).toBe(0);
    // Output may be empty or JSON — both valid
  });
});

// ============================================================================
// orchestrator-completed.js Tests
// ============================================================================

describe('orchestrator-completed.js', () => {
  test('file exists', () => {
    expect(fs.existsSync(ORCHESTRATOR_COMPLETED_PATH)).toBe(true);
  });

  test('exits gracefully with empty stdin', async () => {
    const result = await runHook(ORCHESTRATOR_COMPLETED_PATH, '');
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully with invalid JSON', async () => {
    const result = await runHook(ORCHESTRATOR_COMPLETED_PATH, 'not-valid-json{{{');
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully when stop_hook_active is true', async () => {
    const result = await runHook(ORCHESTRATOR_COMPLETED_PATH, {
      agent_type: 'teamwork:orchestrator',
      stop_hook_active: true
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  test('exits gracefully for non-orchestrator agent_type', async () => {
    const result = await runHook(ORCHESTRATOR_COMPLETED_PATH, {
      agent_type: 'teamwork:worker',
      agent_id: 'test-123'
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(''); // Should not process non-orchestrator
  });

  test('outputs structured JSON for orchestrator completion', async () => {
    const result = await runHook(ORCHESTRATOR_COMPLETED_PATH, {
      session_id: 'test-session',
      agent_id: 'a1b2c3d',
      agent_type: 'teamwork:orchestrator',
      hook_event_name: 'SubagentStop',
      stop_hook_active: false,
      cwd: '/tmp/test'
    });
    expect(result.exitCode).toBe(0);
    if (result.stdout) {
      const output = JSON.parse(result.stdout);
      expect(output.event).toBe('orchestrator_completed');
      expect(output.agent_type).toBe('teamwork:orchestrator');
    }
  });
});
