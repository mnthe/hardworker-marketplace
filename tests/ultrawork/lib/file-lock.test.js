#!/usr/bin/env bun
/**
 * Tests for file-lock.js - File locking utilities
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { acquireLock, releaseLock, withLock } = require('../../../plugins/ultrawork/src/lib/file-lock.js');
const { createTempDir } = require('../../test-utils.js');
const fs = require('fs');
const path = require('path');

describe('file-lock.js', () => {
  let tempDir;
  let testFile;

  beforeEach(() => {
    tempDir = createTempDir('file-lock-test-');
    testFile = path.join(tempDir.path, 'test.txt');
    fs.writeFileSync(testFile, 'test content', 'utf-8');
  });

  afterEach(() => {
    tempDir.cleanup();
  });

  describe('acquireLock', () => {
    test('should acquire lock successfully', async () => {
      const acquired = await acquireLock(testFile);

      expect(acquired).toBe(true);
      expect(fs.existsSync(`${testFile}.lock`)).toBe(true);

      // Cleanup
      releaseLock(testFile);
    });

    test('should fail to acquire lock if already locked', async () => {
      // Acquire first lock
      const first = await acquireLock(testFile, 500);
      expect(first).toBe(true);

      // Try to acquire second lock with short timeout
      const second = await acquireLock(testFile, 500);
      expect(second).toBe(false);

      // Cleanup
      releaseLock(testFile);
    });

    test('should wait and retry on lock contention', async () => {
      // Acquire lock with short timeout
      const first = await acquireLock(testFile, 200);
      expect(first).toBe(true);

      // Release after short delay
      setTimeout(() => releaseLock(testFile), 100);

      // This should succeed after waiting
      const second = await acquireLock(testFile, 500);
      expect(second).toBe(true);

      // Cleanup
      releaseLock(testFile);
    });

    test('should handle custom timeout', async () => {
      const lockPath = `${testFile}.lock`;
      fs.mkdirSync(lockPath); // Create lock manually

      const startTime = Date.now();
      const acquired = await acquireLock(testFile, 300);
      const elapsed = Date.now() - startTime;

      expect(acquired).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(300);
      expect(elapsed).toBeLessThan(500); // Allow some margin

      // Cleanup
      fs.rmdirSync(lockPath);
    });
  });

  describe('releaseLock', () => {
    test('should release lock successfully', async () => {
      await acquireLock(testFile);
      const lockPath = `${testFile}.lock`;
      expect(fs.existsSync(lockPath)).toBe(true);

      releaseLock(testFile);

      expect(fs.existsSync(lockPath)).toBe(false);
    });

    test('should not throw when releasing non-existent lock', () => {
      expect(() => releaseLock(testFile)).not.toThrow();
    });

    test('should allow re-locking after release', async () => {
      await acquireLock(testFile);
      releaseLock(testFile);

      const reacquired = await acquireLock(testFile);
      expect(reacquired).toBe(true);

      // Cleanup
      releaseLock(testFile);
    });
  });

  describe('withLock', () => {
    test('should execute function with lock protection', async () => {
      let executed = false;

      const result = await withLock(testFile, () => {
        executed = true;
        return 'success';
      });

      expect(executed).toBe(true);
      expect(result).toBe('success');
      // Lock should be released
      expect(fs.existsSync(`${testFile}.lock`)).toBe(false);
    });

    test('should handle async functions', async () => {
      const result = await withLock(testFile, async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'async-result';
      });

      expect(result).toBe('async-result');
      expect(fs.existsSync(`${testFile}.lock`)).toBe(false);
    });

    test('should release lock on function error', async () => {
      let error = null;

      try {
        await withLock(testFile, () => {
          throw new Error('Test error');
        });
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toBe('Test error');
      // Lock should still be released
      expect(fs.existsSync(`${testFile}.lock`)).toBe(false);
    });

    test('should throw error if lock cannot be acquired', async () => {
      // Create lock manually
      fs.mkdirSync(`${testFile}.lock`);

      let error = null;
      try {
        await withLock(testFile, () => 'should not run', 500);
      } catch (e) {
        error = e;
      }

      expect(error).not.toBeNull();
      expect(error.message).toContain('Failed to acquire lock');

      // Cleanup
      fs.rmdirSync(`${testFile}.lock`);
    });

    test('should handle concurrent access correctly', async () => {
      let counter = 0;

      const increment = async () => {
        return withLock(testFile, async () => {
          const current = counter;
          await new Promise(resolve => setTimeout(resolve, 50));
          counter = current + 1;
        });
      };

      // Run 3 concurrent increments
      await Promise.all([increment(), increment(), increment()]);

      // Should be 3 if locking works correctly
      expect(counter).toBe(3);
    });
  });
});
