#!/usr/bin/env bun
/**
 * Tests for task-update.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, createMockTask, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/task-update.js');

describe('task-update.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-task-update');
    createMockTask(session.sessionId, '1', {
      subject: 'Test task',
      status: 'open',
      evidence: []
    });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--id', '--status', '--add-evidence']);
    });
  });

  describe('update status', () => {
    test('should update status to resolved', async () => {
      // Must go through in_progress first (valid transition path)
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'in_progress'
      ]);

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'resolved'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK: Task 1 updated');

      // Verify file updated
      const taskFile = path.join(session.sessionDir, 'tasks', '1.json');
      const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
      expect(taskData.status).toBe('resolved');
    });

    test('should update status to in_progress', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'in_progress'
      ]);

      expect(result.exitCode).toBe(0);

      const taskFile = path.join(session.sessionDir, 'tasks', '1.json');
      const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
      expect(taskData.status).toBe('in_progress');
    });
  });

  describe('add evidence', () => {
    test('should add evidence string', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--add-evidence', 'Test evidence 1'
      ]);

      expect(result.exitCode).toBe(0);

      const taskFile = path.join(session.sessionDir, 'tasks', '1.json');
      const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
      expect(taskData.evidence).toContain('Test evidence 1');
    });

    test('should append multiple evidence entries', async () => {
      // Add first evidence
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--add-evidence', 'Evidence 1'
      ]);

      // Add second evidence
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--add-evidence', 'Evidence 2'
      ]);

      const taskFile = path.join(session.sessionDir, 'tasks', '1.json');
      const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
      expect(taskData.evidence.length).toBe(2);
      expect(taskData.evidence).toContain('Evidence 1');
      expect(taskData.evidence).toContain('Evidence 2');
    });
  });

  describe('combined updates', () => {
    test('should update status and add evidence together', async () => {
      // Must go through in_progress first (valid transition path)
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'in_progress'
      ]);

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'resolved',
        '--add-evidence', 'All tests passed'
      ]);

      expect(result.exitCode).toBe(0);

      const taskFile = path.join(session.sessionDir, 'tasks', '1.json');
      const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
      expect(taskData.status).toBe('resolved');
      expect(taskData.evidence).toContain('All tests passed');
    });
  });

  describe('timestamp update', () => {
    test('should update updated_at timestamp', async () => {
      const taskFile = path.join(session.sessionDir, 'tasks', '1.json');
      const before = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));

      await new Promise(resolve => setTimeout(resolve, 100));

      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'in_progress'
      ]);

      const after = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
      expect(after.updated_at).not.toBe(before.updated_at);
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--id', '1',
        '--status', 'resolved'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail when task ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--status', 'resolved'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--id');
    });

    test('should fail for non-existent task', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '999',
        '--status', 'resolved'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });

  describe('alias support', () => {
    test('should support --task alias for --id', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task', '1',
        '--status', 'in_progress'
      ]);

      expect(result.exitCode).toBe(0);
    });

    test('should support --task-id alias for --id', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task-id', '1',
        '--status', 'in_progress'
      ]);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('task ID validation (path traversal prevention)', () => {
    test('should reject path traversal task ID', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '../../etc/passwd',
        '--status', 'in_progress'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid task ID');
    });

    test('should accept numeric task ID', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'in_progress'
      ]);

      expect(result.exitCode).toBe(0);
    });

    test('should reject alphabetic task ID', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'abc',
        '--status', 'in_progress'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid task ID');
    });

    test('should reject negative task ID', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '-1',
        '--status', 'in_progress'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid task ID');
    });
  });

  describe('status validation', () => {
    test('should reject invalid status value', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'banana'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid status');
    });

    test('should reject invalid transition resolved -> in_progress', async () => {
      // Set task to resolved first (open -> in_progress -> resolved)
      createMockTask(session.sessionId, '2', {
        subject: 'Resolved task',
        status: 'resolved',
        evidence: []
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '2',
        '--status', 'in_progress'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid transition');
    });

    test('should allow resolved -> open (Ralph loop)', async () => {
      createMockTask(session.sessionId, '3', {
        subject: 'Ralph loop task',
        status: 'resolved',
        evidence: []
      });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '3',
        '--status', 'open'
      ]);

      expect(result.exitCode).toBe(0);

      const taskFile = path.join(session.sessionDir, 'tasks', '3.json');
      const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
      expect(taskData.status).toBe('open');
    });

    test('should allow open -> in_progress -> resolved happy path', async () => {
      // open -> in_progress
      let result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'in_progress'
      ]);
      expect(result.exitCode).toBe(0);

      // in_progress -> resolved
      result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--status', 'resolved'
      ]);
      expect(result.exitCode).toBe(0);

      const taskFile = path.join(session.sessionDir, 'tasks', '1.json');
      const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
      expect(taskData.status).toBe('resolved');
    });
  });
});
