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

    test('should update phase to VERIFICATION from EXECUTION', async () => {
      // First move to EXECUTION (valid from PLANNING)
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'EXECUTION']);
      // Then move to VERIFICATION (valid from EXECUTION)
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'VERIFICATION']);

      expect(result.exitCode).toBe(0);

      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('VERIFICATION');
    });

    test('should update phase to COMPLETE from VERIFICATION', async () => {
      // First move to EXECUTION (valid from PLANNING)
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'EXECUTION']);
      // Then move to VERIFICATION (valid from EXECUTION)
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'VERIFICATION']);
      // Then move to COMPLETE (valid from VERIFICATION)
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

  describe('update design doc', () => {
    test('should set design doc path with --design-doc', async () => {
      const designPath = '/project/docs/plans/2026-02-08-design.md';
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--design-doc', designPath
      ]);

      expect(result.exitCode).toBe(0);

      const updated = readSession(session.sessionId);
      expect(updated.plan.design_doc).toBe(designPath);
    });

    test('should preserve design doc when updating other fields', async () => {
      const designPath = '/project/docs/plans/2026-02-08-design.md';
      // First set design doc
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--design-doc', designPath
      ]);

      // Then update phase
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'EXECUTION'
      ]);

      const updated = readSession(session.sessionId);
      expect(updated.plan.design_doc).toBe(designPath);
      expect(updated.phase).toBe('EXECUTION');
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

  describe('phase transition validation', () => {
    test('should reject EXECUTION to COMPLETE when skip_verify is false', async () => {
      // Create session in EXECUTION phase with skip_verify=false (default)
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION',
        skip_verify: false
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('VERIFICATION');
      // Phase should remain unchanged
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('EXECUTION');
    });

    test('should include valid alternatives in error message', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION',
        skip_verify: false
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      // Error should mention VERIFICATION as the required step
      expect(result.stderr).toContain('VERIFICATION');
      // Error should mention --force as override option
      expect(result.stderr).toContain('--force');
    });

    test('should allow EXECUTION to COMPLETE with --force flag and print warning', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION',
        skip_verify: false
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE',
        '--force'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('WARNING');
      // Phase should be updated despite validation failure
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('COMPLETE');
    });

    test('should allow EXECUTION to COMPLETE when skip_verify is true', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION',
        skip_verify: true
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('COMPLETE');
    });

    test('should allow valid transition PLANNING to EXECUTION', async () => {
      // Default session starts in PLANNING
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'EXECUTION'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('EXECUTION');
    });

    test('should allow valid transition EXECUTION to VERIFICATION', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'VERIFICATION'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('VERIFICATION');
    });

    test('should allow valid transition VERIFICATION to COMPLETE', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('COMPLETE');
    });

    test('should reject PLANNING to COMPLETE', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('blocked');
    });

    test('should allow any phase to CANCELLED', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'CANCELLED'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('CANCELLED');
    });

    test('should reject transition from terminal state to active state', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'COMPLETE'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'EXECUTION'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('terminal');
    });
  });
});
