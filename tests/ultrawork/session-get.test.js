#!/usr/bin/env bun
/**
 * Tests for session-get.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertJsonSchema, assertHelpText } = require('./test-utils.js');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/session-get.js');

describe('session-get.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-session-get', {
      phase: 'EXECUTION',
      goal: 'Test goal',
      max_workers: 3
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--field', '--dir', '--file']);
    });

    test('should display help with -h', async () => {
      const result = await runScript(SCRIPT_PATH, ['-h']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
    });
  });

  describe('get full session', () => {
    test('should return full session JSON', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId]);

      expect(result.exitCode).toBe(0);
      const parsed = assertJsonSchema(result.stdout, {
        version: 'string',
        session_id: 'string',
        phase: 'string',
        goal: 'string',
        options: 'object'
      });
      expect(parsed.session_id).toBe(session.sessionId);
      expect(parsed.phase).toBe('EXECUTION');
    });
  });

  describe('get specific field', () => {
    test('should return phase field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'phase']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('EXECUTION');
    });

    test('should return goal field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'goal']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Test goal');
    });

    test('should return nested field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'options.max_workers']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('3');
    });

    test('should return JSON for object field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'options']);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.max_workers).toBe(3);
    });
  });

  describe('get directory path', () => {
    test('should return session directory with --dir', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--dir']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(session.sessionId);
      expect(result.stdout).toContain('.claude/ultrawork/sessions');
    });
  });

  describe('get file path', () => {
    test('should return session file path with --file', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--file']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(session.sessionId);
      expect(result.stdout).toContain('session.json');
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
      expect(result.stderr).toContain('required');
    });

    test('should fail for non-existent session', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', 'non-existent-session']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Session not found');
    });

    test('should fail for non-existent field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'nonexistent']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Field');
      expect(result.stderr).toContain('not found');
    });
  });

  describe('alias support', () => {
    test('should support -s alias for --session', async () => {
      const result = await runScript(SCRIPT_PATH, ['-s', session.sessionId, '--field', 'phase']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('EXECUTION');
    });

    test('should support -f alias for --field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '-f', 'goal']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Test goal');
    });
  });
});
