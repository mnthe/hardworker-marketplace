#!/usr/bin/env bun
/**
 * Tests for file-lock.js
 * Tests file locking behavior with owner identification
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const fs = require('fs');
const path = require('path');
const {
  acquireLock,
  releaseLock,
  withLock,
  getLockHolder,
  isLockedBy
} = require('../../../plugins/teamwork/src/lib/file-lock.js');
const { createTempDir } = require('../../test-utils.js');

describe('acquireLock', () => {
  let tmpDir;
  let testFile;

  beforeEach(() => {
    tmpDir = createTempDir('lock-test-');
    testFile = path.join(tmpDir.path, 'test.json');
    fs.writeFileSync(testFile, '{}', 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('acquires lock successfully', async () => {
    const acquired = await acquireLock(testFile);
    expect(acquired).toBe(true);

    // Verify lock directory exists
    const lockPath = `${testFile}.lock`;
    expect(fs.existsSync(lockPath)).toBe(true);

    releaseLock(testFile);
  });

  test('fails to acquire lock when already locked', async () => {
    await acquireLock(testFile);

    // Try to acquire again (with short timeout)
    const acquired = await acquireLock(testFile, 100);
    expect(acquired).toBe(false);

    releaseLock(testFile);
  });

  test('supports reentrant locks with owner', async () => {
    const owner = 'session-123';

    // First acquisition
    const acquired1 = await acquireLock(testFile, owner);
    expect(acquired1).toBe(true);

    // Second acquisition by same owner (reentrant)
    const acquired2 = await acquireLock(testFile, owner);
    expect(acquired2).toBe(true);

    releaseLock(testFile, owner);
  });

  test('blocks different owner from acquiring lock', async () => {
    const owner1 = 'session-123';
    const owner2 = 'session-456';

    await acquireLock(testFile, owner1);

    // Different owner should fail
    const acquired = await acquireLock(testFile, owner2, 100);
    expect(acquired).toBe(false);

    releaseLock(testFile, owner1);
  });

  test('writes holder information', async () => {
    const owner = 'session-123';
    await acquireLock(testFile, owner);

    const holder = getLockHolder(testFile);
    expect(holder).toBeDefined();
    expect(holder.owner).toBe(owner);
    expect(holder.pid).toBe(process.pid);
    expect(holder.acquired_at).toBeDefined();

    releaseLock(testFile, owner);
  });

  test('handles legacy call signature (path, timeout)', async () => {
    // Old signature: acquireLock(path, timeout)
    const acquired = await acquireLock(testFile, 1000);
    expect(acquired).toBe(true);

    releaseLock(testFile);
  });
});

describe('releaseLock', () => {
  let tmpDir;
  let testFile;

  beforeEach(() => {
    tmpDir = createTempDir('lock-test-');
    testFile = path.join(tmpDir.path, 'test.json');
    fs.writeFileSync(testFile, '{}', 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('releases lock successfully', async () => {
    await acquireLock(testFile);

    const released = releaseLock(testFile);
    expect(released).toBe(true);

    // Verify lock directory removed
    const lockPath = `${testFile}.lock`;
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test('only releases lock owned by caller', async () => {
    const owner1 = 'session-123';
    const owner2 = 'session-456';

    await acquireLock(testFile, owner1);

    // Different owner cannot release
    const released = releaseLock(testFile, owner2);
    expect(released).toBe(false);

    // Lock still exists
    const lockPath = `${testFile}.lock`;
    expect(fs.existsSync(lockPath)).toBe(true);

    // Correct owner can release
    releaseLock(testFile, owner1);
  });

  test('handles releasing non-existent lock', () => {
    const released = releaseLock(testFile);
    expect(released).toBe(false);
  });
});

describe('getLockHolder', () => {
  let tmpDir;
  let testFile;

  beforeEach(() => {
    tmpDir = createTempDir('lock-test-');
    testFile = path.join(tmpDir.path, 'test.json');
    fs.writeFileSync(testFile, '{}', 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('returns null for unlocked file', () => {
    const holder = getLockHolder(testFile);
    expect(holder).toBe(null);
  });

  test('returns holder info for locked file', async () => {
    const owner = 'session-123';
    await acquireLock(testFile, owner);

    const holder = getLockHolder(testFile);
    expect(holder).toBeDefined();
    expect(holder.owner).toBe(owner);
    expect(holder.pid).toBe(process.pid);

    releaseLock(testFile, owner);
  });

  test('returns holder with session_id when available', async () => {
    const owner = 'session-123';
    const originalSessionId = process.env.CLAUDE_SESSION_ID;

    process.env.CLAUDE_SESSION_ID = 'test-session';
    await acquireLock(testFile, owner);

    const holder = getLockHolder(testFile);
    expect(holder.session_id).toBe('test-session');

    releaseLock(testFile, owner);

    if (originalSessionId) {
      process.env.CLAUDE_SESSION_ID = originalSessionId;
    } else {
      delete process.env.CLAUDE_SESSION_ID;
    }
  });
});

describe('isLockedBy', () => {
  let tmpDir;
  let testFile;

  beforeEach(() => {
    tmpDir = createTempDir('lock-test-');
    testFile = path.join(tmpDir.path, 'test.json');
    fs.writeFileSync(testFile, '{}', 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('returns false for unlocked file', () => {
    const locked = isLockedBy(testFile, 'session-123');
    expect(locked).toBe(false);
  });

  test('returns true when locked by specified owner', async () => {
    const owner = 'session-123';
    await acquireLock(testFile, owner);

    const locked = isLockedBy(testFile, owner);
    expect(locked).toBe(true);

    releaseLock(testFile, owner);
  });

  test('returns false when locked by different owner', async () => {
    const owner1 = 'session-123';
    const owner2 = 'session-456';

    await acquireLock(testFile, owner1);

    const locked = isLockedBy(testFile, owner2);
    expect(locked).toBe(false);

    releaseLock(testFile, owner1);
  });
});

describe('withLock', () => {
  let tmpDir;
  let testFile;

  beforeEach(() => {
    tmpDir = createTempDir('lock-test-');
    testFile = path.join(tmpDir.path, 'test.json');
    fs.writeFileSync(testFile, '{"value": 0}', 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('executes function with lock protection', async () => {
    const result = await withLock(testFile, () => {
      return 'success';
    });

    expect(result).toBe('success');
  });

  test('releases lock after function completes', async () => {
    await withLock(testFile, () => {
      // Do nothing
    });

    // Lock should be released
    const lockPath = `${testFile}.lock`;
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test('releases lock even when function throws', async () => {
    try {
      await withLock(testFile, () => {
        throw new Error('Test error');
      });
    } catch (err) {
      // Expected
    }

    // Lock should still be released
    const lockPath = `${testFile}.lock`;
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test('supports async functions', async () => {
    const result = await withLock(testFile, async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'async success';
    });

    expect(result).toBe('async success');
  });

  test('supports owner parameter', async () => {
    const owner = 'session-123';

    await withLock(testFile, () => {
      const holder = getLockHolder(testFile);
      expect(holder.owner).toBe(owner);
    }, owner);
  });

  test('handles legacy call signature (path, fn, timeout)', async () => {
    // Old signature: withLock(path, fn, timeout)
    const result = await withLock(testFile, () => 'success', 1000);
    expect(result).toBe('success');
  });

  test('throws when lock cannot be acquired', async () => {
    // Acquire lock first
    await acquireLock(testFile);

    try {
      await withLock(testFile, () => 'should not execute', 100);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err.message).toContain('Failed to acquire lock');
    }

    releaseLock(testFile);
  });
});
