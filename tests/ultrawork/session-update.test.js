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
const fs = require('fs');

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

    test('should update phase to COMPLETE through full lifecycle', async () => {
      // PLANNING -> EXECUTION
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'EXECUTION']);
      // EXECUTION -> VERIFICATION
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'VERIFICATION']);
      // Set verifier approval
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--verifier-passed']);
      // VERIFICATION -> DOCUMENTATION
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'DOCUMENTATION']);
      // Set documenter completion
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--documenter-completed']);
      // DOCUMENTATION -> COMPLETE
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
    test('should reject EXECUTION to COMPLETE (VERIFICATION required)', async () => {
      // Create session in EXECUTION phase
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION'
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
        phase: 'EXECUTION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      // Error should mention VERIFICATION as the required step
      expect(result.stderr).toContain('VERIFICATION');
      // Error should suggest transitioning to VERIFICATION first
      expect(result.stderr).toContain('Transition to VERIFICATION first');
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

    test('should reject VERIFICATION to COMPLETE (DOCUMENTATION required)', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION',
        verifier_passed: true
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('DOCUMENTATION');
    });

    test('should allow valid transition VERIFICATION to DOCUMENTATION with --verifier-passed', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--verifier-passed',
        '--phase', 'DOCUMENTATION'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('DOCUMENTATION');
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

    test('should set verifier_passed when --verifier-passed flag is used during VERIFICATION phase', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--verifier-passed'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.verifier_passed).toBe(true);
    });

    test('should reject --verifier-passed during EXECUTION phase', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--verifier-passed'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('VERIFICATION');
    });

    test('should reject COMPLETE transition without verifier_passed (from DOCUMENTATION)', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'DOCUMENTATION',
        verifier_passed: false
      });

      // Set documenter_completed
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--documenter-completed'
      ]);

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('verifier approval');
    });
  });

  describe('DOCUMENTATION phase support', () => {
    test('should accept DOCUMENTATION as a valid phase', async () => {
      // Move to EXECUTION first, then VERIFICATION, then DOCUMENTATION (with --verifier-passed)
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'EXECUTION']);
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'VERIFICATION']);

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--verifier-passed',
        '--phase', 'DOCUMENTATION'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('DOCUMENTATION');
    });

    test('should normalize DOCUMENTATION phase input', async () => {
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'EXECUTION']);
      await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--phase', 'VERIFICATION']);

      // VERIFICATION → DOCUMENTATION requires --verifier-passed flag
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'documentation',
        '--verifier-passed'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('DOCUMENTATION');
    });
  });

  describe('--documenter-completed flag', () => {
    test('should set documenter_completed during DOCUMENTATION phase', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'DOCUMENTATION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--documenter-completed'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.documenter_completed).toBe(true);
    });

    test('should reject --documenter-completed during EXECUTION phase', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'EXECUTION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--documenter-completed'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('DOCUMENTATION');
    });

    test('should reject --documenter-completed during VERIFICATION phase', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--documenter-completed'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('DOCUMENTATION');
    });
  });

  describe('COMPLETE gate with documenter_completed', () => {
    test('should reject COMPLETE transition from DOCUMENTATION without documenter_completed', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'DOCUMENTATION',
        verifier_passed: true
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--documenter-completed flag');
    });

    test('should allow COMPLETE transition from DOCUMENTATION with documenter_completed', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'DOCUMENTATION',
        verifier_passed: true
      });

      // Set documenter_completed first
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--documenter-completed'
      ]);

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('COMPLETE');
    });

    test('should reject COMPLETE from VERIFICATION (DOCUMENTATION required in new workflow)', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION',
        verifier_passed: true
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('DOCUMENTATION');
    });

    test('should allow COMPLETE with --documenter-completed in same call', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'DOCUMENTATION',
        verifier_passed: true
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--documenter-completed',
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('COMPLETE');
      expect(updated.documenter_completed).toBe(true);
    });
  });

  describe('EXECUTION transition cleanup', () => {
    test('should clean up /tmp/codex-doc-{sessionId}.json on EXECUTION transition', async () => {
      const codexDocPath = `/tmp/codex-doc-${session.sessionId}.json`;
      // Create the file to verify it gets deleted
      fs.writeFileSync(codexDocPath, JSON.stringify({ result: 'test' }));

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'EXECUTION'
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(codexDocPath)).toBe(false);
    });

    test('should still clean up /tmp/codex-{sessionId}.json on EXECUTION transition', async () => {
      const codexPath = `/tmp/codex-${session.sessionId}.json`;
      // Create the file to verify it gets deleted
      fs.writeFileSync(codexPath, JSON.stringify({ result: 'test' }));

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'EXECUTION'
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(codexPath)).toBe(false);
    });

    test('should clean up both codex files on EXECUTION transition', async () => {
      const codexPath = `/tmp/codex-${session.sessionId}.json`;
      const codexDocPath = `/tmp/codex-doc-${session.sessionId}.json`;
      // Create both files
      fs.writeFileSync(codexPath, JSON.stringify({ result: 'test' }));
      fs.writeFileSync(codexDocPath, JSON.stringify({ result: 'doc-test' }));

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'EXECUTION'
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(codexPath)).toBe(false);
      expect(fs.existsSync(codexDocPath)).toBe(false);
    });

    test('should not fail if codex-doc file does not exist on EXECUTION transition', async () => {
      // Ensure file doesn't exist
      const codexDocPath = `/tmp/codex-doc-${session.sessionId}.json`;
      try { fs.unlinkSync(codexDocPath); } catch { /* ignore */ }

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'EXECUTION'
      ]);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('Phase transition guardrails', () => {
    test('should reject VERIFICATION → DOCUMENTATION without --verifier-passed', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'DOCUMENTATION'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--verifier-passed');
    });

    test('should allow VERIFICATION → DOCUMENTATION with --verifier-passed', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION'
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--verifier-passed',
        '--phase', 'DOCUMENTATION'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('DOCUMENTATION');
      expect(updated.verifier_passed).toBe(true);
    });

    test('should allow VERIFICATION → DOCUMENTATION if verifier_passed already set', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'VERIFICATION',
        verifier_passed: true
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'DOCUMENTATION'
      ]);

      expect(result.exitCode).toBe(0);
      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('DOCUMENTATION');
    });

    test('should reject DOCUMENTATION → COMPLETE without --documenter-completed', async () => {
      session.cleanup();
      session = createMockSession('test-session-update', {
        phase: 'DOCUMENTATION',
        verifier_passed: true
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--phase', 'COMPLETE'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--documenter-completed');
    });
  });
});
