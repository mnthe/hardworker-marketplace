#!/usr/bin/env bun
/**
 * Tests for ultrawork-evidence.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/ultrawork-evidence.js');

describe('ultrawork-evidence.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-evidence', {
      phase: 'EXECUTION',
      goal: 'Test evidence display'
    });

    // Create evidence directory and JSONL file
    const evidenceDir = path.join(session.sessionDir, 'evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });

    const evidenceLog = path.join(evidenceDir, 'log.jsonl');
    const entries = [
      {
        type: 'command_execution',
        timestamp: new Date().toISOString(),
        command: 'npm test',
        exit_code: 0,
        output_preview: 'All tests passed'
      },
      {
        type: 'file_operation',
        timestamp: new Date().toISOString(),
        operation: 'write',
        path: 'src/test.ts'
      }
    ];

    fs.writeFileSync(evidenceLog, entries.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session']);
    });
  });

  describe('show evidence log', () => {
    test('should display evidence entries', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ULTRAWORK EVIDENCE LOG');
      expect(result.stdout).toContain('Session ID:');
      expect(result.stdout).toContain('COMMAND_EXECUTION');
      expect(result.stdout).toContain('FILE_OPERATION');
    });

    test('should show session info', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Goal:');
      expect(result.stdout).toContain('Phase:');
    });

    test('should format command execution', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Command:');
      expect(result.stdout).toContain('Exit Code:');
      expect(result.stdout).toContain('npm test');
    });

    test('should format file operation', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Operation:');
      expect(result.stdout).toContain('Path:');
      expect(result.stdout).toContain('write');
    });

    test('should show total evidence count', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Total Evidence Items:');
      expect(result.stdout).toContain('2');
    });
  });

  describe('empty evidence', () => {
    test('should handle no evidence gracefully', async () => {
      const emptySession = createMockSession('empty-evidence');

      const result = await runScript(SCRIPT_PATH, [
        '--session', emptySession.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('(no evidence collected yet)');

      emptySession.cleanup();
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
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
