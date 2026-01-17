#!/usr/bin/env bun
/**
 * Tests for evidence-query.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/evidence-query.js');

describe('evidence-query.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-evidence-query');

    // Create evidence directory and JSONL
    const evidenceDir = path.join(session.sessionDir, 'evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });

    const evidenceLog = path.join(evidenceDir, 'log.jsonl');
    const entries = [
      {
        type: 'command_execution',
        timestamp: '2026-01-17T10:00:00Z',
        command: 'npm test',
        exit_code: 0
      },
      {
        type: 'test_result',
        timestamp: '2026-01-17T10:01:00Z',
        passed: true,
        framework: 'jest'
      },
      {
        type: 'file_operation',
        timestamp: '2026-01-17T10:02:00Z',
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
      assertHelpText(result.stdout, ['--session', '--type', '--last', '--search']);
    });
  });

  describe('query all evidence', () => {
    test('should return all evidence by default', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Evidence Query Results');
    });
  });

  describe('filter by type', () => {
    test('should filter by command_execution type', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--type', 'command_execution'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('command_execution');
      expect(result.stdout).toContain('npm test');
    });

    test('should filter by test_result type', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--type', 'test_result'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test_result');
    });
  });

  describe('filter by last N', () => {
    test('should return last N entries', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--last', '2',
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.length).toBeLessThanOrEqual(2);
    });
  });

  describe('filter by search pattern', () => {
    test('should search for pattern in evidence', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--search', 'npm'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('npm');
    });
  });

  describe('JSON format', () => {
    test('should output JSON with --format json', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
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

  describe('empty results', () => {
    test('should handle no matching evidence', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--search', 'nonexistent-pattern'
      ]);

      expect(result.exitCode).toBe(0);
    });
  });
});
