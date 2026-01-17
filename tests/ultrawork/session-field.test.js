#!/usr/bin/env bun
/**
 * Tests for session-field.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/session-field.js');

describe('session-field.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-session-field', {
      phase: 'PLANNING',
      goal: 'Optimized field extraction test',
      auto_mode: true
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--field']);
    });
  });

  describe('extract single field', () => {
    test('should extract phase field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'phase']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('PLANNING');
    });

    test('should extract goal field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'goal']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Optimized field extraction test');
    });

    test('should extract nested field with dot notation', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'options.auto_mode']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('true');
    });
  });

  describe('JSON output mode', () => {
    test('should output JSON with --json flag', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'phase', '--json']);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.value).toBe('PLANNING');
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, ['--field', 'phase']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail when field missing', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--field');
    });

    test('should fail for non-existent field', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId, '--field', 'nonexistent']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });
});
