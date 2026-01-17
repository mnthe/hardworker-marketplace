#!/usr/bin/env bun
/**
 * Tests for task-get.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, createMockTask, runScript, assertJsonSchema, assertHelpText } = require('./test-utils.js');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/task-get.js');

describe('task-get.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-task-get');
    createMockTask(session.sessionId, '1', {
      subject: 'Test task',
      status: 'open',
      complexity: 'standard',
      criteria: ['Criterion 1', 'Criterion 2'],
      evidence: ['Evidence 1']
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--task-id', '--field']);
    });
  });

  describe('get full task', () => {
    test('should return full task JSON', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task-id', '1'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = assertJsonSchema(result.stdout, {
        id: 'string',
        subject: 'string',
        status: 'string',
        complexity: 'string',
        criteria: 'array',
        evidence: 'array'
      });

      expect(parsed.id).toBe('1');
      expect(parsed.subject).toBe('Test task');
    });
  });

  describe('get specific field', () => {
    test('should return status field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task-id', '1',
        '--field', 'status'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('open');
    });

    test('should return subject field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task-id', '1',
        '--field', 'subject'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Test task');
    });

    test('should return criteria array as JSON', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task-id', '1',
        '--field', 'criteria'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toEqual(['Criterion 1', 'Criterion 2']);
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, ['--task-id', '1']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail when task ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', session.sessionId]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--id');
    });

    test('should fail for non-existent task', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task-id', 'non-existent'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });

    test('should fail for non-existent field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task-id', '1',
        '--field', 'nonexistent'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });

  describe('alias support', () => {
    test('should support --task alias', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task', '1'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.id).toBe('1');
    });

    test('should support --id alias', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.id).toBe('1');
    });
  });
});
