#!/usr/bin/env bun
/**
 * Tests for context-init.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/context-init.js');

describe('context-init.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-context-init');
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--expected']);
    });
  });

  describe('initialize context', () => {
    test('should set expected explorers', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--expected', 'overview,exp-1,exp-2'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK: context.json initialized');
      expect(result.stdout).toContain('overview,exp-1,exp-2');

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.expected_explorers).toEqual(['overview', 'exp-1', 'exp-2']);
      expect(context.exploration_complete).toBe(false);
    });

    test('should update existing context.json', async () => {
      // Initialize first time
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--expected', 'overview'
      ]);

      // Update with new expected explorers
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--expected', 'overview,exp-1'
      ]);

      expect(result.exitCode).toBe(0);

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.expected_explorers).toEqual(['overview', 'exp-1']);
    });

    test('should handle single explorer', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--expected', 'overview'
      ]);

      expect(result.exitCode).toBe(0);

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.expected_explorers).toEqual(['overview']);
    });

    test('should trim whitespace', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--expected', ' overview , exp-1 , exp-2 '
      ]);

      expect(result.exitCode).toBe(0);

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.expected_explorers).toEqual(['overview', 'exp-1', 'exp-2']);
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--expected', 'overview'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail when expected missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--expected');
    });
  });
});
