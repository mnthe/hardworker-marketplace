#!/usr/bin/env bun
/**
 * Tests for task-summary.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, createMockTask, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/task-summary.js');

describe('task-summary.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-task-summary', {
      phase: 'EXECUTION',
      goal: 'Test task summary'
    });
    createMockTask(session.sessionId, '1', {
      subject: 'First task',
      status: 'resolved',
      criteria: ['Criterion 1', 'Criterion 2'],
      evidence: ['Evidence 1', 'Evidence 2']
    });
    createMockTask(session.sessionId, '2', {
      subject: 'Second task',
      status: 'open',
      criteria: ['Criterion A']
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--task', '--save']);
    });
  });

  describe('overview mode', () => {
    test('should generate overview markdown', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('# Task Overview');
      expect(result.stdout).toContain('First task');
      expect(result.stdout).toContain('Second task');
      expect(result.stdout).toContain('Total:');
    });

    test('should show task statistics', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Resolved:');
      expect(result.stdout).toContain('Open:');
    });

    test('should include session info', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('**Session**:');
      expect(result.stdout).toContain('**Phase**:');
      expect(result.stdout).toContain('**Goal**:');
    });
  });

  describe('single task detail', () => {
    test('should generate task detail markdown', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task', '1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Task 1: First task');
      expect(result.stdout).toContain('**Status**: resolved');
      expect(result.stdout).toContain('Success Criteria');
      expect(result.stdout).toContain('Collected Evidence');
    });

    test('should show criteria checkmarks', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task', '1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Criterion 1');
      expect(result.stdout).toContain('Criterion 2');
    });

    test('should list evidence', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task', '1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Evidence 1');
      expect(result.stdout).toContain('Evidence 2');
    });
  });

  describe('save mode', () => {
    test('should save overview to tasks/summary.md', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--save'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Saved to:');

      const summaryFile = path.join(session.sessionDir, 'tasks', 'summary.md');
      expect(fs.existsSync(summaryFile)).toBe(true);

      const content = fs.readFileSync(summaryFile, 'utf-8');
      expect(content).toContain('# Task Overview');
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
      expect(parsed.length).toBe(2);
    });

    test('should output single task JSON', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task', '1',
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.id).toBe('1');
      expect(parsed.subject).toBe('First task');
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

    test('should fail for non-existent task', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task', 'non-existent'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });
});
