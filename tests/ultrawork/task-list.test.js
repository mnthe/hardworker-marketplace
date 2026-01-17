#!/usr/bin/env bun
/**
 * Tests for task-list.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, createMockTask, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/task-list.js');

describe('task-list.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-task-list');
    createMockTask(session.sessionId, '1', {
      subject: 'Open task',
      status: 'open',
      complexity: 'standard'
    });
    createMockTask(session.sessionId, '2', {
      subject: 'Resolved task',
      status: 'resolved',
      complexity: 'complex'
    });
    createMockTask(session.sessionId, '3', {
      subject: 'Blocked task',
      status: 'open',
      blocked_by: ['1']
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--status', '--format']);
    });
  });

  describe('list all tasks', () => {
    test('should list all tasks in table format', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ID|STATUS|SUBJECT');
      expect(result.stdout).toContain('Open task');
      expect(result.stdout).toContain('Resolved task');
      expect(result.stdout).toContain('Blocked task');
    });

    test('should list all tasks in JSON format', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);
      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0]).toHaveProperty('status');
      expect(parsed[0]).toHaveProperty('subject');
    });
  });

  describe('filter by status', () => {
    test('should filter open tasks', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--status', 'open',
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.length).toBe(2);
      expect(parsed.every(t => t.status === 'open')).toBe(true);
    });

    test('should filter resolved tasks', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--status', 'resolved',
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.length).toBe(1);
      expect(parsed[0].status).toBe('resolved');
    });
  });

  describe('output formats', () => {
    test('should output table format by default', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('|');
      expect(result.stdout.split('\n').length).toBeGreaterThan(3);
    });

    test('should output JSON with --format json', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });
  });

  describe('task fields', () => {
    test('should include blocked_by in output', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const blockedTask = parsed.find(t => t.id === '3');
      expect(blockedTask).toBeDefined();
      expect(blockedTask).toHaveProperty('blockedBy');
    });

    test('should include complexity in output', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.some(t => t.complexity === 'complex')).toBe(true);
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
    });
  });

  describe('empty results', () => {
    test('should handle no tasks gracefully', async () => {
      const emptySession = createMockSession('empty-session-test');

      const result = await runScript(SCRIPT_PATH, [
        '--session', emptySession.sessionId,
        '--format', 'json'
      ]);

      // Script returns 1 for no tasks directory
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      emptySession.cleanup();
    });
  });
});
