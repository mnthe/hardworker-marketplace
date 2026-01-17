#!/usr/bin/env bun
/**
 * Tests for context-get.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/context-get.js');

describe('context-get.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-context-get', {
      explorers: [{
        id: 'overview',
        hint: '',
        file: 'exploration/overview.md',
        summary: 'Project overview'
      }],
      key_files: ['file1.ts', 'file2.ts'],
      patterns: ['React', 'TypeScript'],
      exploration_complete: false
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--field', '--summary']);
    });
  });

  describe('get full context', () => {
    test('should return full context JSON', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.explorers).toBeDefined();
      expect(parsed.key_files).toBeDefined();
    });
  });

  describe('get specific field', () => {
    test('should return key_files field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--field', 'key_files'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toContain('file1.ts');
      expect(parsed).toContain('file2.ts');
    });

    test('should return patterns field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--field', 'patterns'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toContain('React');
      expect(parsed).toContain('TypeScript');
    });

    test('should return boolean field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--field', 'exploration_complete'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('false');
    });

    test('should support nested field with dot notation', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--field', 'explorers'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe('overview');
    });
  });

  describe('summary mode', () => {
    test('should generate AI-friendly summary', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--summary'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('# Context Summary');
      expect(result.stdout).toContain('Explorers');
      expect(result.stdout).toContain('Key Files');
      expect(result.stdout).toContain('Patterns');
    });

    test('should show exploration status', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--summary'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('In Progress');
    });
  });

  describe('file path mode', () => {
    test('should return context.json file path', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--file'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('context.json');
      expect(result.stdout).toContain(session.sessionId);
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail for non-existent field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--field', 'nonexistent'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });
});
