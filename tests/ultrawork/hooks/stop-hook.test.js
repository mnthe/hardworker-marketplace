#!/usr/bin/env bun
/**
 * Tests for stop-hook.js - Task counting and corrupted JSON handling
 *
 * Tests the countCompletedTasks and countActiveTasks functions:
 * - 3 tasks (2 resolved, 1 open) -> countCompleted = 2
 * - 1 valid task + 1 corrupted JSON file -> countCompleted = 1, no crash
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, test, expect, beforeEach, afterAll } = require('bun:test');

// Set test base dir BEFORE importing session-utils
const TEST_BASE_DIR = path.join(os.tmpdir(), 'ultrawork-test-stop-hook');
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR;

const {
  countCompletedTasks,
  countActiveTasks,
  checkBlockedPhrases,
  readEvidenceFromLog,
} = require('../../../plugins/ultrawork/src/hooks/stop-hook.js');

// Helper: create a session directory with tasks dir
function createSessionDir(sessionId) {
  const sessionDir = path.join(TEST_BASE_DIR, 'sessions', sessionId);
  const tasksDir = path.join(sessionDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  return sessionDir;
}

// Helper: create a task file
function createTaskFile(sessionDir, taskId, status) {
  const tasksDir = path.join(sessionDir, 'tasks');
  const taskData = {
    id: String(taskId),
    subject: `Task ${taskId}`,
    status,
    criteria: ['test criterion'],
    evidence: [],
  };
  fs.writeFileSync(
    path.join(tasksDir, `${taskId}.json`),
    JSON.stringify(taskData, null, 2),
    'utf-8'
  );
}

// Helper: create a corrupted task file
function createCorruptedTaskFile(sessionDir, taskId) {
  const tasksDir = path.join(sessionDir, 'tasks');
  fs.writeFileSync(
    path.join(tasksDir, `${taskId}.json`),
    '{invalid json content!!!',
    'utf-8'
  );
}

// Cleanup
afterAll(() => {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
  delete process.env.ULTRAWORK_TEST_BASE_DIR;
});

beforeEach(() => {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
});

describe('stop-hook.js - task counting', () => {
  describe('countCompletedTasks', () => {
    test('counts 2 resolved tasks out of 3 total', () => {
      const sessionDir = createSessionDir('test-count');
      createTaskFile(sessionDir, 1, 'resolved');
      createTaskFile(sessionDir, 2, 'resolved');
      createTaskFile(sessionDir, 3, 'open');

      const completed = countCompletedTasks(sessionDir);
      expect(completed).toBe(2);
    });

    test('returns 0 when no tasks exist', () => {
      const sessionDir = createSessionDir('test-empty');
      const completed = countCompletedTasks(sessionDir);
      expect(completed).toBe(0);
    });

    test('returns 0 when tasks directory does not exist', () => {
      const sessionDir = path.join(TEST_BASE_DIR, 'sessions', 'nonexistent');
      fs.mkdirSync(sessionDir, { recursive: true });
      // No tasks dir created
      const completed = countCompletedTasks(sessionDir);
      expect(completed).toBe(0);
    });

    test('handles corrupted JSON gracefully - counts only valid resolved', () => {
      const sessionDir = createSessionDir('test-corrupted');
      createTaskFile(sessionDir, 1, 'resolved');
      createCorruptedTaskFile(sessionDir, 2);

      // Should not crash; should count 1 resolved, skip corrupted
      const completed = countCompletedTasks(sessionDir);
      expect(completed).toBe(1);
    });

    test('skips non-json files', () => {
      const sessionDir = createSessionDir('test-non-json');
      createTaskFile(sessionDir, 1, 'resolved');

      // Create a non-JSON file in tasks dir
      const tasksDir = path.join(sessionDir, 'tasks');
      fs.writeFileSync(path.join(tasksDir, 'summary.md'), '# Summary', 'utf-8');

      const completed = countCompletedTasks(sessionDir);
      expect(completed).toBe(1);
    });
  });

  describe('countActiveTasks', () => {
    test('counts pending and in_progress separately', () => {
      const sessionDir = createSessionDir('test-active');
      createTaskFile(sessionDir, 1, 'open');
      createTaskFile(sessionDir, 2, 'in_progress');
      createTaskFile(sessionDir, 3, 'resolved');
      createTaskFile(sessionDir, 4, 'open');

      const { pending, inProgress } = countActiveTasks(sessionDir);
      expect(pending).toBe(2);
      expect(inProgress).toBe(1);
    });

    test('returns zeros when no tasks exist', () => {
      const sessionDir = createSessionDir('test-no-active');
      const { pending, inProgress } = countActiveTasks(sessionDir);
      expect(pending).toBe(0);
      expect(inProgress).toBe(0);
    });

    test('handles corrupted JSON in active task counting', () => {
      const sessionDir = createSessionDir('test-active-corrupted');
      createTaskFile(sessionDir, 1, 'open');
      createCorruptedTaskFile(sessionDir, 2);

      // Should not crash; should count 1 pending, skip corrupted
      const { pending, inProgress } = countActiveTasks(sessionDir);
      expect(pending).toBe(1);
      expect(inProgress).toBe(0);
    });
  });

  describe('checkBlockedPhrases', () => {
    test('returns null when no blocked phrases found', () => {
      const entries = [
        { type: 'command_execution', output_preview: 'npm test: 5/5 passed' },
        { type: 'file_operation' },
      ];
      expect(checkBlockedPhrases(entries)).toBeNull();
    });

    test('detects "should work" in output_preview', () => {
      const entries = [
        { type: 'command_execution', output_preview: 'This should work now' },
      ];
      expect(checkBlockedPhrases(entries)).toBe('should work');
    });

    test('detects "TODO:" in output', () => {
      const entries = [
        { type: 'command_execution', output_preview: 'Added TODO: fix later' },
      ];
      expect(checkBlockedPhrases(entries)).toBe('TODO:');
    });

    test('only checks last 5 entries', () => {
      // Create 10 entries, blocked phrase in entry #2 (outside last 5)
      const entries = [];
      for (let i = 0; i < 10; i++) {
        entries.push({
          type: 'command_execution',
          output_preview: i === 1 ? 'This should work' : 'clean output',
        });
      }
      // Entry 1 is outside last 5 (entries 5-9), so should not detect
      expect(checkBlockedPhrases(entries)).toBeNull();
    });
  });

  describe('readEvidenceFromLog', () => {
    test('returns empty when no evidence log exists', () => {
      createSessionDir('test-no-evidence');
      const result = readEvidenceFromLog('test-no-evidence');
      expect(result.total).toBe(0);
      expect(result.entries).toEqual([]);
    });

    test('reads JSONL entries from log file', () => {
      const sessionDir = createSessionDir('test-evidence-log');
      const evidenceDir = path.join(sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });

      const entries = [
        { type: 'command_execution', timestamp: '2026-01-01T00:00:00Z', command: 'ls' },
        { type: 'file_operation', timestamp: '2026-01-01T00:01:00Z', operation: 'write', path: '/src/a.ts' },
      ];

      const logContent = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      fs.writeFileSync(path.join(evidenceDir, 'log.jsonl'), logContent, 'utf-8');

      const result = readEvidenceFromLog('test-evidence-log');
      expect(result.total).toBe(2);
      expect(result.entries[0].type).toBe('command_execution');
      expect(result.entries[1].type).toBe('file_operation');
    });
  });
});
