#!/usr/bin/env bun
/**
 * Tests for gate-enforcement.js - PLANNING→EXECUTION Codex doc-review gate
 *
 * Tests the new gate that checks /tmp/codex-doc-{sessionId}.json
 * before allowing session-update --phase EXECUTION from PLANNING phase.
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const {
  createMockSession,
  cleanupAllTestSessions,
  TEST_BASE_DIR
} = require('../test-utils.js');

const HOOK_PATH = path.join(
  __dirname,
  '../../../plugins/ultrawork/src/hooks/gate-enforcement.js'
);

/**
 * Run the gate-enforcement hook with given stdin input
 * @param {Object} hookInput - Hook input object
 * @param {Object} [session] - Mock session object (for env setup)
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, json: Object|null}>}
 */
async function runHook(hookInput, session = null) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      ULTRAWORK_TEST_BASE_DIR: TEST_BASE_DIR
    };

    const proc = spawn('bun', [HOOK_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (exitCode) => {
      let json = null;
      try {
        json = JSON.parse(stdout.trim());
      } catch {
        // not JSON
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: exitCode || 0, json });
    });

    // Write hook input to stdin and close
    proc.stdin.write(JSON.stringify(hookInput));
    proc.stdin.end();
  });
}

/**
 * Get codex-doc result path for a session ID
 * @param {string} sessionId
 * @returns {string}
 */
function getCodexDocResultPath(sessionId) {
  return `/tmp/codex-doc-${sessionId}.json`;
}

/**
 * Write a codex-doc result file
 * @param {string} sessionId
 * @param {Object} content
 */
function writeCodexDocResult(sessionId, content) {
  const filePath = getCodexDocResultPath(sessionId);
  fs.writeFileSync(filePath, JSON.stringify(content), 'utf-8');
  return filePath;
}

/**
 * Remove codex-doc result file if it exists
 * @param {string} sessionId
 */
function removeCodexDocResult(sessionId) {
  const filePath = getCodexDocResultPath(sessionId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

describe('gate-enforcement.js - Codex doc-review gate (PLANNING→EXECUTION)', () => {
  let session;
  const sessionId = 'test-codex-doc-gate-' + Date.now();

  beforeEach(() => {
    session = createMockSession(sessionId, { phase: 'PLANNING' });
    // Clean up any leftover codex-doc result files
    removeCodexDocResult(sessionId);
  });

  afterEach(() => {
    session.cleanup();
    removeCodexDocResult(sessionId);
  });

  describe('getCodexDocResultPath helper', () => {
    test('helper function returns correct path format', () => {
      const resultPath = getCodexDocResultPath('my-session-123');
      expect(resultPath).toBe('/tmp/codex-doc-my-session-123.json');
    });

    test('helper function includes sessionId in path', () => {
      const id = 'abc-def-123';
      const resultPath = getCodexDocResultPath(id);
      expect(resultPath).toContain(id);
      expect(resultPath).toContain('/tmp/codex-doc-');
    });
  });

  describe('Criterion: 게이트가 결과 파일 없으면 BLOCK', () => {
    test('blocks session-update --phase EXECUTION when codex-doc file does not exist', async () => {
      // No codex-doc file exists (default from beforeEach)
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('block');
    });

    test('blocks session-update -p EXECUTION (short form) when file does not exist', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} -p EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('block');
    });

    test('block message mentions codex-doc or doc-review', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      const additionalContext = result.json?.hookSpecificOutput?.additionalContext || '';
      const reason = result.json?.hookSpecificOutput?.reason || '';
      const combined = additionalContext + reason;

      // Should mention what to do or the missing file
      expect(combined.toLowerCase()).toMatch(/codex|doc.review|doc_review/i);
    });
  });

  describe('Criterion: SKIP verdict면 ALLOW', () => {
    test('allows session-update --phase EXECUTION when verdict is SKIP', async () => {
      writeCodexDocResult(sessionId, {
        verdict: 'SKIP',
        summary: 'Codex not available',
        doc_review: null
      });

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });
  });

  describe('Criterion: PASS verdict면 ALLOW', () => {
    test('allows session-update --phase EXECUTION when verdict is PASS', async () => {
      writeCodexDocResult(sessionId, {
        verdict: 'PASS',
        summary: 'All checks passed',
        doc_review: { doc_issues: [] }
      });

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });
  });

  describe('Criterion: FAIL verdict면 BLOCK with 이슈 표시', () => {
    test('blocks session-update --phase EXECUTION when verdict is FAIL', async () => {
      writeCodexDocResult(sessionId, {
        verdict: 'FAIL',
        summary: 'Documentation issues found',
        doc_issues: [
          { severity: 'error', category: 'missing', detail: 'Missing section: Requirements' }
        ]
      });

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('block');
    });

    test('FAIL block message includes doc_issues details', async () => {
      writeCodexDocResult(sessionId, {
        verdict: 'FAIL',
        summary: 'Documentation issues found',
        doc_issues: [
          { severity: 'error', category: 'missing', detail: 'Missing section: Requirements' },
          { severity: 'error', category: 'incomplete', detail: 'Incomplete acceptance criteria' }
        ]
      });

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      const additionalContext = result.json?.hookSpecificOutput?.additionalContext || '';
      // Should show the issues
      expect(additionalContext).toContain('Missing section: Requirements');
    });
  });

  describe('Criterion: PLANNING 이외 phase에서는 영향 없음', () => {
    test('allows session-update --phase EXECUTION from EXECUTION phase (no gate)', async () => {
      // Session is in EXECUTION phase (not PLANNING)
      session.cleanup();
      session = createMockSession(sessionId, { phase: 'EXECUTION' });
      // No codex-doc file exists

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      // Not blocked - gate only applies when PLANNING → EXECUTION
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('allows session-update --phase EXECUTION from VERIFICATION phase (no gate)', async () => {
      session.cleanup();
      session = createMockSession(sessionId, { phase: 'VERIFICATION' });

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('does not affect session-update --phase VERIFICATION from PLANNING', async () => {
      // No codex-doc file exists; transitioning to VERIFICATION (not EXECUTION)
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase VERIFICATION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      // Gate only blocks EXECUTION transitions from PLANNING
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('does not affect non-session-update commands', async () => {
      // Regular bash command (not session-update) should not be affected
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: 'echo "--phase EXECUTION"'
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });
  });

  describe('Edge cases', () => {
    test('allows when codex-doc file has corrupt JSON (graceful degradation)', async () => {
      const filePath = getCodexDocResultPath(sessionId);
      fs.writeFileSync(filePath, 'not-valid-json', 'utf-8');

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput, session);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      // Graceful degradation: allow on parse error
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });
  });
});
