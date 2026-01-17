#!/usr/bin/env bun
/**
 * Tests for ultrawork-clean.js
 */

const { describe, test, expect, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/ultrawork-clean.js');

describe('ultrawork-clean.js', () => {
  const sessions = [];

  afterEach(() => {
    sessions.forEach(s => s.cleanup());
    sessions.length = 0;
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--all', '--completed', '--older-than']);
    });
  });

  describe('single session clean', () => {
    test('should delete single session', async () => {
      const session = createMockSession('test-clean-single');
      sessions.push(session);

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.session_id).toBe(session.sessionId);

      // Verify session deleted
      expect(fs.existsSync(session.sessionDir)).toBe(false);
    });

    test('should handle already deleted session', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', 'non-existent-session'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain('already clean');
    });
  });

  describe('batch cleanup - completed', () => {
    test('should delete completed sessions', async () => {
      const completedSession = createMockSession('completed-session', { phase: 'COMPLETE' });
      const activeSession = createMockSession('active-session', { phase: 'PLANNING' });
      sessions.push(completedSession, activeSession);

      const result = await runScript(SCRIPT_PATH, ['--completed']);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.deleted_count).toBeGreaterThanOrEqual(1);

      // Active session should still exist
      expect(fs.existsSync(activeSession.sessionDir)).toBe(true);
    });

    test('should delete cancelled sessions', async () => {
      const cancelledSession = createMockSession('cancelled-session', { phase: 'CANCELLED' });
      sessions.push(cancelledSession);

      const result = await runScript(SCRIPT_PATH, ['--completed']);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.deleted_count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('batch cleanup - older-than', () => {
    test('should accept older-than parameter', async () => {
      const result = await runScript(SCRIPT_PATH, ['--older-than', '30']);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('deleted_count');
      expect(parsed).toHaveProperty('preserved_count');
    });
  });

  describe('batch cleanup - all', () => {
    test('should delete all sessions with --all', async () => {
      const session1 = createMockSession('all-session-1', { phase: 'PLANNING' });
      const session2 = createMockSession('all-session-2', { phase: 'COMPLETE' });
      sessions.push(session1, session2);

      const result = await runScript(SCRIPT_PATH, ['--all']);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.deleted_count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error cases', () => {
    test('should fail when no session ID and not batch mode', async () => {
      // Remove env var to ensure no default
      delete process.env.CLAUDE_SESSION_ID;

      const result = await runScript(SCRIPT_PATH, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });
  });

  describe('output format', () => {
    test('should return JSON output', async () => {
      const session = createMockSession('json-output');
      sessions.push(session);

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    test('should include session metadata in output', async () => {
      const session = createMockSession('metadata-test', {
        goal: 'Test goal',
        phase: 'PLANNING'
      });
      sessions.push(session);

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.goal).toBe('Test goal');
      expect(parsed.phase).toBe('PLANNING');
    });
  });
});
