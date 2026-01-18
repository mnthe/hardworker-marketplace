#!/usr/bin/env bun
/**
 * Tests for session-update.js
 *
 * IMPORTANT: Uses ULTRAWORK_TEST_BASE_DIR for test isolation
 */

const { describe, test, expect, beforeEach, afterEach, afterAll } = require('bun:test');
const {
  createMockSession,
  runScript,
  assertJsonSchema,
  assertHelpText,
  TEST_BASE_DIR,
  cleanupAllTestSessions
} = require('./test-utils.js');
const path = require('path');

// Set test base directory BEFORE importing session-utils
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR;
const { readSession } = require('../../plugins/ultrawork/src/lib/session-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/session-update.js');

describe('session-update.js', () => {
  let session;

  afterAll(() => {
    cleanupAllTestSessions();
    delete process.env.ULTRAWORK_TEST_BASE_DIR;
  });

  beforeEach(() => {
    session = createMockSession('test-session-update', {
      phase: 'PLANNING',
      exploration_stage: 'not_started'
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--phase', '--exploration-stage']);
    });
  });

  describe('update phase', () => {
    test('should update phase to EXECUTION', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'EXECUTION']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK:');

      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('EXECUTION');
    });

    test('should update phase to VERIFICATION', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'VERIFICATION']);

      expect(result.exitCode).toBe(0);

      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('VERIFICATION');
    });

    test('should update phase to COMPLETE', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'COMPLETE']);

      expect(result.exitCode).toBe(0);

      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('COMPLETE');
    });
  });

  describe('update exploration stage', () => {
    test('should update exploration stage to overview', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--exploration-stage', 'overview']);

      expect(result.exitCode).toBe(0);

      const updated = readSession(session.sessionId);
      expect(updated.exploration_stage).toBe('overview');
    });

    test('should update exploration stage to complete', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--exploration-stage', 'complete']);

      expect(result.exitCode).toBe(0);

      const updated = readSession(session.sessionId);
      expect(updated.exploration_stage).toBe('complete');
    });
  });

  describe('update plan approval', () => {
    test('should set plan approval timestamp with --plan-approved', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--plan-approved']);

      expect(result.exitCode).toBe(0);

      const updated = readSession(session.sessionId);
      expect(updated.plan.approved_at).not.toBeNull();
      expect(typeof updated.plan.approved_at).toBe('string');
    });
  });

  describe('multiple updates', () => {
    test('should update phase and exploration stage together', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'EXECUTION',
        '--exploration-stage', 'complete'
      ]);

      expect(result.exitCode).toBe(0);

      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('EXECUTION');
      expect(updated.exploration_stage).toBe('complete');
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, ['--phase', 'EXECUTION']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail for non-existent session', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', 'non-existent', '--phase', 'EXECUTION']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Session not found');
    });
  });

  describe('timestamp update', () => {
    test('should update updated_at timestamp', async () => {
      const before = readSession(session.sessionId);

      await new Promise(resolve => setTimeout(resolve, 100));

      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'EXECUTION']);

      const after = readSession(session.sessionId);
      expect(after.updated_at).not.toBe(before.updated_at);
    });
  });
});
