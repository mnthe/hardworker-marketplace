#!/usr/bin/env bun
/**
 * Tests for scope-set.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/scope-set.js');

describe('scope-set.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-scope-set');
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--data']);
    });
  });

  describe('set scope expansion', () => {
    test('should set scope expansion data', async () => {
      const scopeData = JSON.stringify({
        originalRequest: 'Add feature X',
        detectedLayers: ['frontend', 'backend'],
        dependencies: [],
        suggestedTasks: [
          { layer: 'backend', description: 'Add API' },
          { layer: 'frontend', description: 'Add UI' }
        ]
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--data', scopeData
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK: Scope expansion set');
      expect(result.stdout).toContain('frontend, backend');

      const contextFile = path.join(session.sessionDir, 'context.json');
      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.scopeExpansion).toBeDefined();
      expect(context.scopeExpansion.originalRequest).toBe('Add feature X');
      expect(context.scopeExpansion.detectedLayers).toEqual(['frontend', 'backend']);
    });

    test('should show summary info', async () => {
      const scopeData = JSON.stringify({
        originalRequest: 'Test request',
        detectedLayers: ['frontend'],
        dependencies: [{ from: 'A', to: 'B', type: 'blocking' }],
        suggestedTasks: [{ layer: 'frontend', description: 'Task 1' }]
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--data', scopeData
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Layers: frontend');
      expect(result.stdout).toContain('Dependencies: 1');
      expect(result.stdout).toContain('Suggested tasks: 1');
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--data', '{}'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail when data missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--data');
    });

    test('should fail for invalid JSON', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--data', 'invalid-json'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    test('should fail without originalRequest', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--data', JSON.stringify({ detectedLayers: [] })
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('originalRequest');
    });
  });
});
