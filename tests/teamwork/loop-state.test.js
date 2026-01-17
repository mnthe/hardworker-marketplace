#!/usr/bin/env bun
/**
 * Tests for loop-state.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, createTempDir, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/loop-state.js');

describe('loop-state.js', () => {
  let tempDir;

  beforeEach(() => {
    const temp = createTempDir('teamwork-test-');
    tempDir = temp.path;
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('loop-state');
  });

  test('gets loop state when no state exists', () => {
    const result = runScript(SCRIPT_PATH, { get: '' }, {
      env: { ...process.env, HOME: tempDir }
    });

    // Script exits with 1 when no state exists
    expect(result.exitCode).toBe(1);
    expect(result.json).toBeTruthy();

    assertJsonSchema(result.json, {
      active: 'boolean'
    });

    expect(result.json.active).toBe(false);
  });

  test('starts loop state', () => {
    const result = runScript(SCRIPT_PATH, {
      start: '',
      project: 'test-project',
      team: 'test-team',
      role: 'backend'
    }, {
      env: { ...process.env, HOME: tempDir }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.status).toBe('success');
    expect(result.json.state.active).toBe(true);
    expect(result.json.state.project).toBe('test-project');
    expect(result.json.state.team).toBe('test-team');
    expect(result.json.state.role).toBe('backend');
  });

  test('clears loop state', () => {
    const sessionId = 'test-session-clear-123';

    // Start loop first
    runScript(SCRIPT_PATH, {
      start: '',
      project: 'test-project',
      team: 'test-team',
      role: 'backend'
    }, {
      env: { ...process.env, HOME: tempDir, CLAUDE_SESSION_ID: sessionId }
    });

    // Clear loop
    const result = runScript(SCRIPT_PATH, { clear: '' }, {
      env: { ...process.env, HOME: tempDir, CLAUDE_SESSION_ID: sessionId }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.status).toBe('success');
    expect(result.json.message).toContain('Loop stopped');
  });

  test('fails to start without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      start: '',
      project: 'test-project'
    }, {
      env: { ...process.env, HOME: tempDir }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--project');
    expect(result.stderr).toContain('--team');
    expect(result.stderr).toContain('--role');
  });

  test('creates loop state directory', () => {
    const result = runScript(SCRIPT_PATH, {
      start: '',
      project: 'test-project',
      team: 'test-team',
      role: 'backend'
    }, {
      env: { ...process.env, HOME: tempDir }
    });

    expect(result.exitCode).toBe(0);

    const loopStateDir = path.join(tempDir, '.claude', 'teamwork', '.loop-state');
    expect(fs.existsSync(loopStateDir)).toBe(true);
  });

  test('gets active loop state', () => {
    const sessionId = 'test-session-get-456';

    // Start a loop first
    runScript(SCRIPT_PATH, {
      start: '',
      project: 'test-project',
      team: 'test-team',
      role: 'backend'
    }, {
      env: { ...process.env, HOME: tempDir, CLAUDE_SESSION_ID: sessionId }
    });

    // Now get the state
    const result = runScript(SCRIPT_PATH, { get: '' }, {
      env: { ...process.env, HOME: tempDir, CLAUDE_SESSION_ID: sessionId }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.active).toBe(true);
    expect(result.json.project).toBe('test-project');
  });
});
