#!/usr/bin/env bun
/**
 * Tests for context-add.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/context-add.js');

describe('context-add.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-context-add', {
      expected_explorers: ['overview', 'exp-1']
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--explorer-id', '--summary']);
    });
  });

  describe('add explorer', () => {
    test('should add explorer to context', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'overview',
        '--file', 'exploration/overview.md',
        '--summary', 'Overview summary'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK: Explorer overview added');

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.explorers.length).toBe(1);
      expect(context.explorers[0].id).toBe('overview');
      expect(context.explorers[0].summary).toBe('Overview summary');
    });

    test('should set file path', async () => {
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'exp-1',
        '--file', 'exploration/exp-1.md',
        '--summary', 'Test'
      ]);

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.explorers[0].file).toBe('exploration/exp-1.md');
    });

    test('should merge key files', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'overview',
        '--summary', 'Test',
        '--key-files', 'file1.ts,file2.ts'
      ]);

      expect(result.exitCode).toBe(0);

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.key_files).toContain('file1.ts');
      expect(context.key_files).toContain('file2.ts');
    });

    test('should merge patterns', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'overview',
        '--summary', 'Test',
        '--patterns', 'React,TypeScript'
      ]);

      expect(result.exitCode).toBe(0);

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.patterns).toContain('React');
      expect(context.patterns).toContain('TypeScript');
    });
  });

  describe('exploration completion', () => {
    test('should mark exploration complete when all expected explorers added', async () => {
      // Add first explorer
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'overview',
        '--summary', 'Overview'
      ]);

      // Add second explorer - should trigger completion
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'exp-1',
        '--summary', 'Exp 1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('All expected explorers complete');

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.exploration_complete).toBe(true);
    });

    test('should not mark complete if explorers not matched', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'overview',
        '--summary', 'Overview'
      ]);

      expect(result.exitCode).toBe(0);

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.exploration_complete).toBe(false);
    });
  });

  describe('duplicate handling', () => {
    test('should skip duplicate explorer', async () => {
      // Add first time
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'overview',
        '--summary', 'First'
      ]);

      // Try to add again
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--explorer-id', 'overview',
        '--summary', 'Second'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('already exists');

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.explorers.length).toBe(1);
      expect(context.explorers[0].summary).toBe('First');
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--explorer-id', 'overview',
        '--summary', 'Test'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail when explorer ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--summary', 'Test'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--explorer-id');
    });
  });
});
