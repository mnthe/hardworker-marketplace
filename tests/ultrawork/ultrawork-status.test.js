#!/usr/bin/env bun
/**
 * Tests for ultrawork-status.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, createMockTask, runScript, assertHelpText } = require('./test-utils.js');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/ultrawork-status.js');

describe('ultrawork-status.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-status', {
      phase: 'EXECUTION',
      exploration_stage: 'complete',
      goal: 'Test goal'
    });
    createMockTask(session.sessionId, '1', { subject: 'Task 1' });
    createMockTask(session.sessionId, '2', { subject: 'Task 2' });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--all']);
    });
  });

  describe('show session status', () => {
    test('should display session information', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ULTRAWORK SESSION STATUS');
      expect(result.stdout).toContain('Session ID:');
      expect(result.stdout).toContain('Goal:');
      expect(result.stdout).toContain('Phase:');
    });

    test('should show workflow progress', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('WORKFLOW');
      expect(result.stdout).toContain('PLANNING');
      expect(result.stdout).toContain('EXECUTION');
      expect(result.stdout).toContain('VERIFICATION');
      expect(result.stdout).toContain('COMPLETE');
    });

    test('should show task count', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('STATS');
      expect(result.stdout).toContain('Tasks:');
      expect(result.stdout).toContain('2');
    });

    test('should show session directory structure', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('SESSION DIRECTORY');
      expect(result.stdout).toContain('session.json');
      expect(result.stdout).toContain('context.json');
    });
  });

  describe('phase indicators', () => {
    test('should show EXECUTION phase as active', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[→] EXECUTION');
    });

    test('should show completed phases with checkmark', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[✓] PLANNING');
    });
  });

  describe('list all sessions', () => {
    test('should list all sessions with --all', async () => {
      const result = await runScript(SCRIPT_PATH, ['--all']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ALL ULTRAWORK SESSIONS');
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing and --all not provided', async () => {
      const result = await runScript(SCRIPT_PATH, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail for non-existent session', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', 'non-existent'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });
});
