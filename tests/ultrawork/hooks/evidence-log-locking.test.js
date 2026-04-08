#!/usr/bin/env bun
/**
 * Tests for evidence log file locking in hooks
 *
 * Verifies that post-tool-use-evidence.js and subagent-stop-tracking.js
 * use acquireLock/releaseLock around JSONL evidence log appends,
 * and skip writes on lock failure (no unlocked fallback).
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

  describe('lock failure behavior', () => {
    test('post-tool-use-evidence.js skips write on lock failure (no unlocked fallback)', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js'),
        'utf-8'
      );

      // Should have exactly 1 appendFileSync call (inside lock only)
      const appendCalls = hookSource.match(/fs\.appendFileSync\(evidenceLog/g);
      expect(appendCalls).not.toBeNull();
      expect(appendCalls.length).toBe(1); // only locked path, no fallback

      // Should log warning on lock timeout
      expect(hookSource).toContain('evidence log lock timeout, skipping write');
    });

    test('subagent-stop-tracking.js skips write on lock failure (no unlocked fallback)', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/subagent-stop-tracking.js'),
        'utf-8'
      );

      // Should have exactly 1 appendFileSync call (inside lock only)
      const appendCalls = hookSource.match(/fs\.appendFileSync\(evidenceLogFile/g);
      expect(appendCalls).not.toBeNull();
      expect(appendCalls.length).toBe(1); // only locked path, no fallback

      // Should log warning on lock timeout
      expect(hookSource).toContain('evidence log lock timeout, skipping write');
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

    test('write is skipped when lock cannot be acquired', async () => {
      // Simulate lock timeout scenario: hold lock, second acquire fails
      const logFile = path.join(tempDir.path, 'log.jsonl');

      // Hold a lock to simulate contention
      const firstLock = await acquireLock(logFile, 1000);
      expect(firstLock).toBe(true);

      // Try to acquire with very short timeout - should fail
      const secondLock = await acquireLock(logFile, 200);
      expect(secondLock).toBe(false);

      // Release original lock
      releaseLock(logFile);

      // File should not exist (no write happened since lock failed)
      expect(fs.existsSync(logFile)).toBe(false);
    });
  });

  describe('lock ordering', () => {
    test('post-tool-use-evidence.js documents lock ordering convention', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js'),
        'utf-8'
      );

      expect(hookSource).toContain('Lock ordering: session.json');
      expect(hookSource).toContain('evidence/log.jsonl');
    });

    test('subagent-stop-tracking.js documents lock ordering convention', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/subagent-stop-tracking.js'),
        'utf-8'
      );

      expect(hookSource).toContain('Lock ordering: session.json');
      expect(hookSource).toContain('evidence/log.jsonl');
    });

    test('subagent-stop-tracking.js acquires session lock before evidence lock', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/subagent-stop-tracking.js'),
        'utf-8'
      );

      // updateSession acquires session.json lock internally
      const sessionLockIndex = hookSource.indexOf('await updateSession(sessionId');
      // evidence log lock acquired after
      const evidenceLockIndex = hookSource.indexOf('acquireLock(evidenceLogFile');

      expect(sessionLockIndex).toBeGreaterThan(-1);
      expect(evidenceLockIndex).toBeGreaterThan(-1);
      expect(sessionLockIndex).toBeLessThan(evidenceLockIndex);
    });

    test('post-tool-use-evidence.js only acquires evidence lock (no session lock)', () => {
      const hookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js'),
        'utf-8'
      );

      // Should NOT call updateSession (which acquires session lock)
      expect(hookSource).not.toContain('updateSession(');

      // Should only acquire evidence log lock
      expect(hookSource).toContain('acquireLock(evidenceLog');
    });

    test('both hooks use 15000ms lock timeout', () => {
      const postHookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js'),
        'utf-8'
      );
      const subagentHookSource = fs.readFileSync(
        path.join(__dirname, '../../../plugins/ultrawork/src/hooks/subagent-stop-tracking.js'),
        'utf-8'
      );

      expect(postHookSource).toContain('acquireLock(evidenceLog, 15000)');
      expect(subagentHookSource).toContain('acquireLock(evidenceLogFile, 15000)');
    });
  });
});
