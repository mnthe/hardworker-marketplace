#!/usr/bin/env bun
/**
 * Tests for optimistic-lock.js
 * Tests optimistic concurrency control for task claiming
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const fs = require('fs');
const path = require('path');
const {
  claimTaskOptimistic,
  writeWithVersionCheck,
  releaseTaskOptimistic
} = require('../../../plugins/teamwork/src/lib/optimistic-lock.js');
const { createTempDir } = require('../../test-utils.js');

describe('claimTaskOptimistic', () => {
  let tmpDir;
  let taskFile;

  beforeEach(() => {
    tmpDir = createTempDir('opt-lock-test-');
    taskFile = path.join(tmpDir.path, 'task-1.json');

    // Create initial task
    const task = {
      id: '1',
      title: 'Test task',
      role: 'backend',
      status: 'open',
      version: 0,
      claimed_by: null,
      claimed_at: null,
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('claims open task successfully', async () => {
    const result = await claimTaskOptimistic(taskFile, 'session-123');

    expect(result.success).toBe(true);
    expect(result.task).toBeDefined();
    expect(result.task.claimed_by).toBe('session-123');
    expect(result.task.status).toBe('in_progress');
    expect(result.task.version).toBe(1);
  });

  test('updates claimed_at timestamp', async () => {
    const result = await claimTaskOptimistic(taskFile, 'session-123');

    expect(result.task.claimed_at).toBeDefined();
    const claimedTime = new Date(result.task.claimed_at).getTime();
    const now = Date.now();
    expect(Math.abs(claimedTime - now)).toBeLessThan(1000); // Within 1 second
  });

  test('allows reentrant claim by same session', async () => {
    await claimTaskOptimistic(taskFile, 'session-123');

    // Claim again with same session
    const result = await claimTaskOptimistic(taskFile, 'session-123');

    expect(result.success).toBe(true);
    expect(result.task.claimed_by).toBe('session-123');
  });

  test('blocks claim when already claimed by different session', async () => {
    await claimTaskOptimistic(taskFile, 'session-123');

    // Try to claim with different session
    const result = await claimTaskOptimistic(taskFile, 'session-456');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_claimed');
  });

  test('fails when task file not found', async () => {
    const nonExistentFile = path.join(tmpDir.path, 'non-existent.json');

    const result = await claimTaskOptimistic(nonExistentFile, 'session-123');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('task_not_found');
  });

  test('fails when task status is resolved', async () => {
    // Update task to resolved status
    const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    task.status = 'resolved';
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf8');

    const result = await claimTaskOptimistic(taskFile, 'session-123');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_claimable');
  });

  test('allows claim for in_progress task by same session', async () => {
    // Set task to in_progress with session-123
    const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    task.status = 'in_progress';
    task.claimed_by = 'session-123';
    task.version = 1;
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf8');

    const result = await claimTaskOptimistic(taskFile, 'session-123');

    expect(result.success).toBe(true);
    expect(result.task.claimed_by).toBe('session-123');
  });

  test('increments version on successful claim', async () => {
    const result1 = await claimTaskOptimistic(taskFile, 'session-123');
    expect(result1.task.version).toBe(1);

    // Release and claim again
    await releaseTaskOptimistic(taskFile, 'session-123');
    const result2 = await claimTaskOptimistic(taskFile, 'session-456');
    expect(result2.task.version).toBe(3); // Released (2), then claimed again (3)
  });

  test('writes file atomically', async () => {
    await claimTaskOptimistic(taskFile, 'session-123');

    // Verify file is valid JSON
    const content = fs.readFileSync(taskFile, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();

    // Verify no temp files left
    const files = fs.readdirSync(tmpDir.path);
    const tempFiles = files.filter(f => f.includes('.tmp'));
    expect(tempFiles.length).toBe(0);
  });
});

describe('writeWithVersionCheck', () => {
  let tmpDir;
  let taskFile;

  beforeEach(() => {
    tmpDir = createTempDir('opt-lock-test-');
    taskFile = path.join(tmpDir.path, 'task-1.json');

    const task = {
      id: '1',
      title: 'Test task',
      version: 1,
      data: 'initial'
    };
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('writes successfully when version matches', async () => {
    const updatedTask = {
      id: '1',
      title: 'Updated task',
      version: 2,
      data: 'updated'
    };

    const result = await writeWithVersionCheck(taskFile, updatedTask, 1);

    expect(result.success).toBe(true);

    const written = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    expect(written.data).toBe('updated');
    expect(written.version).toBe(2);
  });

  test('fails when version does not match', async () => {
    const updatedTask = {
      id: '1',
      title: 'Updated task',
      version: 2,
      data: 'updated'
    };

    // Pass wrong expected version
    const result = await writeWithVersionCheck(taskFile, updatedTask, 5);

    expect(result.success).toBe(false);

    // Original data unchanged
    const current = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    expect(current.data).toBe('initial');
    expect(current.version).toBe(1);
  });

  test('fails when file does not exist', async () => {
    const nonExistentFile = path.join(tmpDir.path, 'non-existent.json');
    const task = { id: '1', version: 1 };

    const result = await writeWithVersionCheck(nonExistentFile, task, 0);

    expect(result.success).toBe(false);
  });

  test('handles version 0 correctly', async () => {
    // Create task with version 0
    const task = { id: '1', version: 0 };
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf8');

    const updatedTask = { id: '1', version: 1, data: 'updated' };
    const result = await writeWithVersionCheck(taskFile, updatedTask, 0);

    expect(result.success).toBe(true);
  });

  test('writes atomically using temp file', async () => {
    const updatedTask = {
      id: '1',
      title: 'Updated task',
      version: 2,
      data: 'updated'
    };

    await writeWithVersionCheck(taskFile, updatedTask, 1);

    // Verify no temp files left
    const files = fs.readdirSync(tmpDir.path);
    const tempFiles = files.filter(f => f.includes('.tmp'));
    expect(tempFiles.length).toBe(0);
  });
});

describe('releaseTaskOptimistic', () => {
  let tmpDir;
  let taskFile;

  beforeEach(() => {
    tmpDir = createTempDir('opt-lock-test-');
    taskFile = path.join(tmpDir.path, 'task-1.json');

    // Create claimed task
    const task = {
      id: '1',
      title: 'Test task',
      role: 'backend',
      status: 'in_progress',
      version: 1,
      claimed_by: 'session-123',
      claimed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('releases claimed task successfully', async () => {
    const result = await releaseTaskOptimistic(taskFile, 'session-123');

    expect(result.success).toBe(true);
    expect(result.task.claimed_by).toBe(null);
    expect(result.task.claimed_at).toBe(null);
    expect(result.task.status).toBe('open');
    expect(result.task.version).toBe(2);
  });

  test('fails when releasing task not claimed by caller', async () => {
    const result = await releaseTaskOptimistic(taskFile, 'session-456');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_claimed_by_claimer');
  });

  test('fails when task file not found', async () => {
    const nonExistentFile = path.join(tmpDir.path, 'non-existent.json');

    const result = await releaseTaskOptimistic(nonExistentFile, 'session-123');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('task_not_found');
  });

  test('increments version on release', async () => {
    const beforeVersion = JSON.parse(fs.readFileSync(taskFile, 'utf8')).version;

    await releaseTaskOptimistic(taskFile, 'session-123');

    const afterVersion = JSON.parse(fs.readFileSync(taskFile, 'utf8')).version;
    expect(afterVersion).toBe(beforeVersion + 1);
  });

  test('writes file atomically', async () => {
    await releaseTaskOptimistic(taskFile, 'session-123');

    // Verify file is valid JSON
    const content = fs.readFileSync(taskFile, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();

    // Verify no temp files left
    const files = fs.readdirSync(tmpDir.path);
    const tempFiles = files.filter(f => f.includes('.tmp'));
    expect(tempFiles.length).toBe(0);
  });
});

describe('Concurrent Access Simulation', () => {
  let tmpDir;
  let taskFile;

  beforeEach(() => {
    tmpDir = createTempDir('opt-lock-test-');
    taskFile = path.join(tmpDir.path, 'task-1.json');

    const task = {
      id: '1',
      title: 'Test task',
      role: 'backend',
      status: 'open',
      version: 0,
      claimed_by: null,
      claimed_at: null,
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf8');
  });

  afterEach(() => {
    tmpDir.cleanup();
  });

  test('only one session successfully claims task in race condition', async () => {
    // Simulate two sessions trying to claim simultaneously
    const results = await Promise.all([
      claimTaskOptimistic(taskFile, 'session-123'),
      claimTaskOptimistic(taskFile, 'session-456')
    ]);

    // One should succeed, one should fail
    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;

    expect(successes).toBe(1);
    expect(failures).toBe(1);

    // File should be claimed by exactly one session
    const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    expect(task.claimed_by).toMatch(/session-(123|456)/);
    expect(task.status).toBe('in_progress');
  });

  test('sequential claims work correctly', async () => {
    // Session 1 claims
    const result1 = await claimTaskOptimistic(taskFile, 'session-123');
    expect(result1.success).toBe(true);

    // Session 2 tries to claim (should fail)
    const result2 = await claimTaskOptimistic(taskFile, 'session-456');
    expect(result2.success).toBe(false);

    // Session 1 releases
    const result3 = await releaseTaskOptimistic(taskFile, 'session-123');
    expect(result3.success).toBe(true);

    // Session 2 claims again (should succeed now)
    const result4 = await claimTaskOptimistic(taskFile, 'session-456');
    expect(result4.success).toBe(true);
  });
});
