#!/usr/bin/env bun
/**
 * Tests for gate-enforcement.js - Codex result file protection
 *
 * Tests that manual rm/unlink of codex result files is blocked,
 * while general rm commands and read-only access are allowed.
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
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, json: Object|null}>}
 */
async function runHook(hookInput) {
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

describe('gate-enforcement.js - Codex result file protection', () => {
  let session;
  const sessionId = 'test-codex-rm-' + Date.now();

  beforeEach(() => {
    session = createMockSession(sessionId, { phase: 'EXECUTION' });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('Criterion: rm codex result file blocked', () => {
    test('blocks rm /tmp/codex-{sessionId}.json', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `rm /tmp/codex-${sessionId}.json`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('block');
    });

    test('blocks rm /tmp/codex-doc-{sessionId}.json', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `rm /tmp/codex-doc-${sessionId}.json`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('block');
    });

    test('blocks rm -f /tmp/codex-{sessionId}.json (with flags)', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `rm -f /tmp/codex-${sessionId}.json`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('block');
    });

    test('blocks unlink /tmp/codex-{sessionId}.json', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `unlink /tmp/codex-${sessionId}.json`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('block');
    });
  });

  describe('Criterion: general rm commands not blocked', () => {
    test('allows rm /tmp/some-other-file.json', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: 'rm /tmp/some-other-file.json'
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('allows cat /tmp/codex-{sessionId}.json (read-only, not rm)', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `cat /tmp/codex-${sessionId}.json`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('allows rm of non-codex file even if path contains codex substring', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: 'rm /tmp/not-a-codex-file.txt'
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });
  });

  describe('Criterion: block message contains alternative guidance', () => {
    test('block message mentions codex-verify.js as alternative', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `rm /tmp/codex-${sessionId}.json`
        }
      };

      const result = await runHook(hookInput);

      const additionalContext = result.json?.hookSpecificOutput?.additionalContext || '';
      expect(additionalContext).toContain('codex-verify.js');
    });

    test('block message mentions session-update.js as alternative', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `rm /tmp/codex-doc-${sessionId}.json`
        }
      };

      const result = await runHook(hookInput);

      const additionalContext = result.json?.hookSpecificOutput?.additionalContext || '';
      expect(additionalContext).toContain('session-update.js');
    });
  });
});
