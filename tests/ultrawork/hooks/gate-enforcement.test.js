#!/usr/bin/env bun
/**
 * Tests for gate-enforcement.js - Codex doc-review gate
 * PLANNING -> EXECUTION transition requires doc-review result
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, test, expect, beforeEach, afterAll } = require('bun:test');

// Set test base dir BEFORE importing session-utils
const TEST_BASE_DIR = path.join(os.tmpdir(), 'ultrawork-test-gate');
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR;

const {
  getCodexDocResultPath,
  checkCodexDocGate
} = require('../../../plugins/ultrawork/src/hooks/gate-enforcement.js');

const { createPreToolUseAllow } = require('../../../plugins/ultrawork/src/lib/hook-utils.js');

// Helper: create mock session directory with session.json
function createMockSessionForGate(sessionId, phase) {
  const sessionDir = path.join(TEST_BASE_DIR, 'sessions', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'tasks'), { recursive: true });

  const sessionData = {
    version: '6.1',
    session_id: sessionId,
    working_dir: '/tmp/test-project',
    goal: 'Test goal',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phase,
    exploration_stage: 'complete',
    iteration: 1,
    plan: { approved_at: null },
    options: { max_workers: 0, max_iterations: 5, plan_only: false, auto_mode: false },
    verifier_passed: false,
    cancelled_at: null
  };

  fs.writeFileSync(
    path.join(sessionDir, 'session.json'),
    JSON.stringify(sessionData, null, 2),
    'utf-8'
  );

  return sessionDir;
}

// Cleanup
afterAll(() => {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
  delete process.env.ULTRAWORK_TEST_BASE_DIR;
});

// Cleanup between tests
beforeEach(() => {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
});

describe('gate-enforcement.js - Codex doc-review gate', () => {
  describe('getCodexDocResultPath', () => {
    test('returns correct path for session ID', () => {
      const result = getCodexDocResultPath('abc-123');
      expect(result).toBe('/tmp/codex-doc-abc-123.json');
    });
  });

  describe('checkCodexDocGate', () => {
    test('ALLOW when result file does not exist (advisory: file missing)', () => {
      const sessionId = 'test-no-file';
      createMockSessionForGate(sessionId, 'PLANNING');

      const command = `bun /path/to/session-update.js --session ${sessionId} --phase EXECUTION`;
      const result = checkCodexDocGate(sessionId, command);

      // Advisory: allow through when result file is missing
      expect(result).toBeNull();
    });

    test('ALLOW when verdict is SKIP', () => {
      const sessionId = 'test-skip';
      createMockSessionForGate(sessionId, 'PLANNING');

      // Write SKIP verdict file
      const resultPath = getCodexDocResultPath(sessionId);
      fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'SKIP' }), 'utf-8');

      const command = `bun /path/to/session-update.js --session ${sessionId} --phase EXECUTION`;
      const result = checkCodexDocGate(sessionId, command);

      // null means ALLOW (no block)
      expect(result).toBeNull();

      // Cleanup temp file
      fs.unlinkSync(resultPath);
    });

    test('ALLOW when verdict is PASS', () => {
      const sessionId = 'test-pass';
      createMockSessionForGate(sessionId, 'PLANNING');

      // Write PASS verdict file
      const resultPath = getCodexDocResultPath(sessionId);
      fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'PASS' }), 'utf-8');

      const command = `bun /path/to/session-update.js --session ${sessionId} --phase EXECUTION`;
      const result = checkCodexDocGate(sessionId, command);

      expect(result).toBeNull();

      fs.unlinkSync(resultPath);
    });

    test('BLOCK when verdict is FAIL with issues displayed', () => {
      const sessionId = 'test-fail';
      createMockSessionForGate(sessionId, 'PLANNING');

      const resultPath = getCodexDocResultPath(sessionId);
      fs.writeFileSync(resultPath, JSON.stringify({
        verdict: 'FAIL',
        summary: 'Documentation issues found',
        doc_issues: [
          { severity: 'error', category: 'missing-section', detail: 'Missing API docs' },
          { severity: 'warning', category: 'style', detail: 'Inconsistent formatting' }
        ]
      }), 'utf-8');

      const command = `bun /path/to/session-update.js --session ${sessionId} --phase EXECUTION`;
      const result = checkCodexDocGate(sessionId, command);

      expect(result).not.toBeNull();
      expect(result.hookSpecificOutput.decision).toBe('block');
      expect(result.hookSpecificOutput.reason).toContain('FAIL');
      // Should include the error-severity issue
      expect(result.hookSpecificOutput.additionalContext).toContain('Missing API docs');

      fs.unlinkSync(resultPath);
    });

    test('no effect when current phase is NOT PLANNING', () => {
      const sessionId = 'test-execution-phase';
      createMockSessionForGate(sessionId, 'EXECUTION');

      // No result file exists, but since phase is EXECUTION, gate should not apply
      const command = `bun /path/to/session-update.js --session ${sessionId} --phase EXECUTION`;
      const result = checkCodexDocGate(sessionId, command);

      // null means no gate applied
      expect(result).toBeNull();
    });

    test('no effect when command does not target EXECUTION phase', () => {
      const sessionId = 'test-other-phase-target';
      createMockSessionForGate(sessionId, 'PLANNING');

      // Command targets VERIFICATION, not EXECUTION
      const command = `bun /path/to/session-update.js --session ${sessionId} --phase VERIFICATION`;
      const result = checkCodexDocGate(sessionId, command);

      expect(result).toBeNull();
    });

    test('no effect when command is not session-update', () => {
      const sessionId = 'test-other-command';
      createMockSessionForGate(sessionId, 'PLANNING');

      const command = `bun /path/to/task-update.js --session ${sessionId} --status resolved`;
      const result = checkCodexDocGate(sessionId, command);

      expect(result).toBeNull();
    });

    test('ALLOW when result file has parse error (graceful degradation)', () => {
      const sessionId = 'test-corrupt';
      createMockSessionForGate(sessionId, 'PLANNING');

      const resultPath = getCodexDocResultPath(sessionId);
      fs.writeFileSync(resultPath, 'not valid json{{{', 'utf-8');

      const command = `bun /path/to/session-update.js --session ${sessionId} --phase EXECUTION`;
      const result = checkCodexDocGate(sessionId, command);

      // Graceful degradation: parse error -> ALLOW
      expect(result).toBeNull();

      fs.unlinkSync(resultPath);
    });

    test('handles -p shorthand for --phase (no file = allow)', () => {
      const sessionId = 'test-shorthand';
      createMockSessionForGate(sessionId, 'PLANNING');

      // No result file, advisory: allow through
      const command = `bun /path/to/session-update.js --session ${sessionId} -p EXECUTION`;
      const result = checkCodexDocGate(sessionId, command);

      // Advisory: allow through when result file is missing
      expect(result).toBeNull();
    });
  });
});
