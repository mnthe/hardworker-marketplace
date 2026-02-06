#!/usr/bin/env bun
/**
 * Tests for v3 hook system: project-progress.js and teammate-idle.js
 * Also validates hooks.json structure.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Run a hook script with JSON input piped via stdin
 * @param {string} scriptPath - Absolute path to hook script
 * @param {Object|string} stdinInput - Input to pipe to stdin (object will be JSON.stringify'd)
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
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

    // Write stdin input and close
    const input = typeof stdinInput === 'object' ? JSON.stringify(stdinInput) : stdinInput;
    proc.stdin.write(input);
    proc.stdin.end();
  });
}

// ============================================================================
// hooks.json Tests
// ============================================================================

describe('hooks.json', () => {
  test('file exists', () => {
    expect(fs.existsSync(HOOKS_JSON_PATH)).toBe(true);
  });

  test('is valid JSON', () => {
    const content = fs.readFileSync(HOOKS_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toBeDefined();
  });

  test('defines TaskCompleted hook', () => {
    const content = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
    expect(content.hooks).toBeDefined();
    expect(content.hooks.TaskCompleted).toBeDefined();
    expect(Array.isArray(content.hooks.TaskCompleted)).toBe(true);
    expect(content.hooks.TaskCompleted.length).toBeGreaterThan(0);

    const taskCompletedHook = content.hooks.TaskCompleted[0];
    expect(taskCompletedHook.matcher).toBe('*');
    expect(taskCompletedHook.hooks).toBeDefined();
    expect(taskCompletedHook.hooks[0].type).toBe('command');
    expect(taskCompletedHook.hooks[0].command).toContain('project-progress.js');
    expect(taskCompletedHook.hooks[0].command).toContain('bun');
  });

  test('defines TeammateIdle hook', () => {
    const content = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
    expect(content.hooks.TeammateIdle).toBeDefined();
    expect(Array.isArray(content.hooks.TeammateIdle)).toBe(true);
    expect(content.hooks.TeammateIdle.length).toBeGreaterThan(0);

    const teammateIdleHook = content.hooks.TeammateIdle[0];
    expect(teammateIdleHook.matcher).toBe('*');
    expect(teammateIdleHook.hooks).toBeDefined();
    expect(teammateIdleHook.hooks[0].type).toBe('command');
    expect(teammateIdleHook.hooks[0].command).toContain('teammate-idle.js');
    expect(teammateIdleHook.hooks[0].command).toContain('bun');
  });

  test('does NOT define old Stop hook (loop-detector)', () => {
    const content = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
    expect(content.hooks.Stop).toBeUndefined();
  });

  test('does NOT define old PostToolUse hook (evidence-capture)', () => {
    const content = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf-8'));
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

  test('exits gracefully with invalid JSON stdin', async () => {
    const result = await runHook(PROJECT_PROGRESS_PATH, 'not-valid-json{{{');
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully with empty object stdin', async () => {
    const result = await runHook(PROJECT_PROGRESS_PATH, {});
    expect(result.exitCode).toBe(0);
  });

  test('outputs progress message when given valid input', async () => {
    const result = await runHook(PROJECT_PROGRESS_PATH, {
      task_id: '1',
      team_name: 'test-team',
      status: 'completed'
    });
    expect(result.exitCode).toBe(0);
    // Should not crash - output can be empty or contain progress info
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

  test('exits gracefully with invalid JSON stdin', async () => {
    const result = await runHook(TEAMMATE_IDLE_PATH, 'not-valid-json{{{');
    expect(result.exitCode).toBe(0);
  });

  test('exits gracefully with empty object stdin', async () => {
    const result = await runHook(TEAMMATE_IDLE_PATH, {});
    expect(result.exitCode).toBe(0);
  });

  test('outputs idle message when given teammate info', async () => {
    const result = await runHook(TEAMMATE_IDLE_PATH, {
      teammate_name: 'worker-backend',
      team_name: 'test-team'
    });
    expect(result.exitCode).toBe(0);
    // Should not crash - output can be empty or contain idle info
  });
});
