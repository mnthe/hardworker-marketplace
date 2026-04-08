#!/usr/bin/env bun
/**
 * Tests for evidence log file locking in hooks
 *
 * Verifies that post-tool-use-evidence.js and subagent-stop-tracking.js
 * use acquireLock/releaseLock around JSONL evidence log appends,
 * with fallback to unlocked append on lock timeout.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createTempDir } = require('../../test-utils.js');
const { acquireLock, releaseLock } = require('../../../plugins/ultrawork/src/lib/file-lock.js');

describe('evidence log locking', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir('evidence-lock-test-');
  });

  afterEach(() => {
    tempDir.cleanup();
  });

  describe('post-tool-use-evidence.js imports file-lock', () => {
    test('source file requires acquireLock and releaseLock from file-lock.js', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js'),
        'utf-8'
      );

      expect(hookSource).toContain("require('../lib/file-lock.js')");
      expect(hookSource).toContain('acquireLock');
      expect(hookSource).toContain('releaseLock');
    });

    test('source file calls acquireLock before appendFileSync for evidence log', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js'),
        'utf-8'
      );

      // The lock acquire should appear before the append in the evidence section
      const acquireIndex = hookSource.indexOf('acquireLock(evidenceLog');
      const appendIndex = hookSource.indexOf("fs.appendFileSync(evidenceLog, line, 'utf-8')");

      expect(acquireIndex).toBeGreaterThan(-1);
      expect(appendIndex).toBeGreaterThan(-1);
      expect(acquireIndex).toBeLessThan(appendIndex);
    });

    test('source file calls releaseLock in finally block', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js'),
        'utf-8'
      );

      expect(hookSource).toContain('releaseLock(evidenceLog)');
      // Verify finally pattern
      expect(hookSource).toMatch(/finally\s*\{[\s\S]*?releaseLock\(evidenceLog\)/);
    });
  });

  describe('subagent-stop-tracking.js imports file-lock', () => {
    test('source file requires acquireLock and releaseLock from file-lock.js', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/subagent-stop-tracking.js'),
        'utf-8'
      );

      expect(hookSource).toContain("require('../lib/file-lock.js')");
      expect(hookSource).toContain('acquireLock');
      expect(hookSource).toContain('releaseLock');
    });

    test('source file calls acquireLock before appendFileSync for evidence log', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/subagent-stop-tracking.js'),
        'utf-8'
      );

      // The lock acquire should appear before the append in the evidence section
      const acquireIndex = hookSource.indexOf('acquireLock(evidenceLogFile');
      const appendIndex = hookSource.indexOf("fs.appendFileSync(evidenceLogFile, logLine, 'utf-8')");

      expect(acquireIndex).toBeGreaterThan(-1);
      expect(appendIndex).toBeGreaterThan(-1);
      expect(acquireIndex).toBeLessThan(appendIndex);
    });

    test('source file calls releaseLock in finally block', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/subagent-stop-tracking.js'),
        'utf-8'
      );

      expect(hookSource).toContain('releaseLock(evidenceLogFile)');
      // Verify finally pattern
      expect(hookSource).toMatch(/finally\s*\{[\s\S]*?releaseLock\(evidenceLogFile\)/);
    });
  });

  describe('fallback behavior on lock timeout', () => {
    test('post-tool-use-evidence.js has fallback append without lock', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js'),
        'utf-8'
      );

      // Should have a fallback pattern: if lock not acquired, append anyway
      // Count appendFileSync calls - should be more than 1 (locked + fallback)
      const appendCalls = hookSource.match(/fs\.appendFileSync\(evidenceLog/g);
      expect(appendCalls).not.toBeNull();
      expect(appendCalls.length).toBeGreaterThanOrEqual(2); // locked path + fallback path
    });

    test('subagent-stop-tracking.js has fallback append without lock', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/subagent-stop-tracking.js'),
        'utf-8'
      );

      // Should have a fallback pattern: if lock not acquired, append anyway
      const appendCalls = hookSource.match(/fs\.appendFileSync\(evidenceLogFile/g);
      expect(appendCalls).not.toBeNull();
      expect(appendCalls.length).toBeGreaterThanOrEqual(2); // locked path + fallback path
    });

    test('locked append followed by unlock actually writes data', async () => {
      // Integration test: verify the locking pattern works end-to-end
      const logFile = path.join(tempDir.path, 'log.jsonl');
      const evidence = { type: 'test', timestamp: new Date().toISOString() };
      const line = JSON.stringify(evidence) + '\n';

      const acquired = await acquireLock(logFile, 5000);
      expect(acquired).toBe(true);

      try {
        fs.appendFileSync(logFile, line, 'utf-8');
      } finally {
        releaseLock(logFile);
      }

      // Verify file content
      const content = fs.readFileSync(logFile, 'utf-8');
      expect(content).toBe(line);
      const parsed = JSON.parse(content.trim());
      expect(parsed.type).toBe('test');
    });

    test('fallback append without lock still writes data', async () => {
      // Simulate lock timeout scenario: hold lock, then fallback
      const logFile = path.join(tempDir.path, 'log.jsonl');
      const evidence = { type: 'fallback_test', timestamp: new Date().toISOString() };
      const line = JSON.stringify(evidence) + '\n';

      // Hold a lock to simulate contention
      const firstLock = await acquireLock(logFile, 1000);
      expect(firstLock).toBe(true);

      // Try to acquire with very short timeout - should fail
      const secondLock = await acquireLock(logFile, 200);
      expect(secondLock).toBe(false);

      // Fallback: append without lock (data > consistency)
      fs.appendFileSync(logFile, line, 'utf-8');

      // Release original lock
      releaseLock(logFile);

      // Verify data was written despite lock failure
      const content = fs.readFileSync(logFile, 'utf-8');
      expect(content).toBe(line);
      const parsed = JSON.parse(content.trim());
      expect(parsed.type).toBe('fallback_test');
    });
  });
});
