#!/usr/bin/env bun
/**
 * Tests for gate-enforcement.js - Codex blocking gates removal
 *
 * Verifies that:
 * 1. Codex result file rm protection is removed (rm of codex files allowed)
 * 2. verifier-passed no longer requires Codex result file
 * 3. Doc-review gate allows when result file is missing (advisory)
 * 4. Doc-review gate still blocks when result file has FAIL verdict
 * 5. getCodexResultPath and isCodexInstalled are removed from exports
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

function getCodexDocResultPath(sessionId) {
  return `/tmp/codex-doc-${sessionId}.json`;
}

function writeCodexDocResult(sessionId, content) {
  const filePath = getCodexDocResultPath(sessionId);
  fs.writeFileSync(filePath, JSON.stringify(content), 'utf-8');
  return filePath;
}

function removeCodexDocResult(sessionId) {
  const filePath = getCodexDocResultPath(sessionId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

describe('gate-enforcement.js - Codex blocking gates removal', () => {
  let session;
  const sessionId = 'test-codex-removal-' + Date.now();

  beforeEach(() => {
    session = createMockSession(sessionId, { phase: 'EXECUTION' });
    removeCodexDocResult(sessionId);
  });

  afterEach(() => {
    session.cleanup();
    removeCodexDocResult(sessionId);
    // Clean up codex result files too
    const codexPath = `/tmp/codex-${sessionId}.json`;
    if (fs.existsSync(codexPath)) {
      fs.unlinkSync(codexPath);
    }
  });

  // =========================================================================
  // Criterion 1: Codex result file rm protection removed
  // =========================================================================
  describe('Criterion: Codex result file rm protection removed', () => {
    test('allows rm /tmp/codex-{sessionId}.json (no longer blocked)', async () => {
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
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('allows rm /tmp/codex-doc-{sessionId}.json (no longer blocked)', async () => {
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
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('allows unlink /tmp/codex-{sessionId}.json (no longer blocked)', async () => {
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
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });
  });

  // =========================================================================
  // Criterion 2: verifier-passed no longer requires Codex result file
  // =========================================================================
  describe('Criterion: verifier-passed no longer requires Codex result file', () => {
    test('allows --verifier-passed without codex result file', async () => {
      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --verifier-passed`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('allows --verifier-passed even when codex FAIL result exists', async () => {
      // Write a FAIL result file
      const codexPath = `/tmp/codex-${sessionId}.json`;
      fs.writeFileSync(codexPath, JSON.stringify({
        verdict: 'FAIL',
        summary: 'Failed checks'
      }), 'utf-8');

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --verifier-passed`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });
  });

  // =========================================================================
  // Criterion 3: Doc-review gate allows when result file missing (advisory)
  // =========================================================================
  describe('Criterion: Doc-review gate allows when result file missing', () => {
    test('allows PLANNING->EXECUTION when doc-review result file missing', async () => {
      // Recreate session in PLANNING phase
      session.cleanup();
      session = createMockSession(sessionId, { phase: 'PLANNING' });
      // No codex-doc result file exists

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });

    test('still blocks PLANNING->EXECUTION when doc-review FAIL exists', async () => {
      session.cleanup();
      session = createMockSession(sessionId, { phase: 'PLANNING' });

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

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('block');
    });

    test('still allows PLANNING->EXECUTION when doc-review PASS exists', async () => {
      session.cleanup();
      session = createMockSession(sessionId, { phase: 'PLANNING' });

      writeCodexDocResult(sessionId, {
        verdict: 'PASS',
        summary: 'All checks passed'
      });

      const hookInput = {
        session_id: sessionId,
        tool_name: 'Bash',
        tool_input: {
          command: `bun session-update.js --session ${sessionId} --phase EXECUTION`
        }
      };

      const result = await runHook(hookInput);

      expect(result.exitCode).toBe(0);
      expect(result.json).not.toBeNull();
      expect(result.json.hookSpecificOutput.decision).toBe('allow');
    });
  });

  // =========================================================================
  // Criterion 4: Unused helpers removed from exports
  // =========================================================================
  describe('Criterion: getCodexResultPath and isCodexInstalled removed from exports', () => {
    test('getCodexResultPath is not exported', () => {
      const mod = require('../../../plugins/ultrawork/src/hooks/gate-enforcement.js');
      expect(mod.getCodexResultPath).toBeUndefined();
    });

    test('isCodexInstalled is not exported', () => {
      const mod = require('../../../plugins/ultrawork/src/hooks/gate-enforcement.js');
      expect(mod.isCodexInstalled).toBeUndefined();
    });

    test('getCodexDocResultPath is still exported', () => {
      const mod = require('../../../plugins/ultrawork/src/hooks/gate-enforcement.js');
      expect(typeof mod.getCodexDocResultPath).toBe('function');
    });

    test('checkCodexDocGate is still exported', () => {
      const mod = require('../../../plugins/ultrawork/src/hooks/gate-enforcement.js');
      expect(typeof mod.checkCodexDocGate).toBe('function');
    });
  });
});
