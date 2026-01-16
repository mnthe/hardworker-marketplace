#!/usr/bin/env bun
/**
 * optimistic-lock.js - Optimistic concurrency control for task claiming
 *
 * Implements version-based optimistic locking to handle concurrent task claims
 * across multiple worker sessions. Uses atomic write operations to prevent
 * race conditions.
 */

const fs = require('fs');

/**
 * @typedef {import('./types.js').Task} Task
 */

/**
 * @typedef {Object} ClaimResult
 * @property {boolean} success - Whether the claim was successful
 * @property {string} [reason] - Failure reason: 'already_claimed' | 'version_conflict'
 * @property {Task} [task] - Updated task (on success)
 */

/**
 * @typedef {Object} WriteResult
 * @property {boolean} success - Whether the write was successful
 */

/**
 * Attempt to claim a task using optimistic concurrency control.
 *
 * This function reads the task, checks if it's claimable, and attempts to
 * atomically update it with a version check. If another process claims the
 * task between read and write, the version check will fail.
 *
 * @param {string} taskPath - Absolute path to the task file
 * @param {string} claimerId - Unique identifier for the claimer (session ID)
 * @returns {Promise<ClaimResult>} Result object indicating success or failure
 *
 * @example
 * const result = await claimTaskOptimistic('/path/to/task.json', 'session-abc');
 * if (result.success) {
 *   console.log('Claimed task:', result.task);
 * } else {
 *   console.log('Failed to claim:', result.reason);
 * }
 */
async function claimTaskOptimistic(taskPath, claimerId) {
  // Read current task state
  if (!fs.existsSync(taskPath)) {
    return { success: false, reason: 'task_not_found' };
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  /** @type {Task} */
  const task = JSON.parse(content);

  // Check if already claimed by someone else
  if (task.claimed_by && task.claimed_by !== claimerId) {
    return { success: false, reason: 'already_claimed' };
  }

  // Check if task is not in open status (blocked, resolved, etc.)
  if (task.status !== 'open' && task.status !== 'in_progress') {
    return { success: false, reason: 'not_claimable' };
  }

  // Store version for optimistic concurrency control
  const originalVersion = task.version || 0;

  // Prepare update
  task.claimed_by = claimerId;
  task.claimed_at = new Date().toISOString();
  task.status = 'in_progress';
  task.version = originalVersion + 1;
  task.updated_at = new Date().toISOString();

  // Atomic write with version check
  const result = await writeWithVersionCheck(taskPath, task, originalVersion);

  if (!result.success) {
    // Version conflict - another worker claimed it
    return { success: false, reason: 'version_conflict' };
  }

  return { success: true, task };
}

/**
 * Write data to a file only if the version hasn't changed.
 *
 * This function implements optimistic concurrency control by:
 * 1. Re-reading the file to check current version
 * 2. Comparing with expected version
 * 3. Writing atomically (temp file + rename) if versions match
 *
 * The atomic write (write to temp, then rename) is atomic on most filesystems
 * including ext4, APFS, and NTFS.
 *
 * @param {string} path - Absolute path to the file
 * @param {Task} data - Data to write (must include version field)
 * @param {number} expectedVersion - Expected current version
 * @returns {Promise<WriteResult>} Result object indicating success or failure
 *
 * @example
 * const result = await writeWithVersionCheck('/path/to/task.json', updatedTask, 5);
 * if (!result.success) {
 *   console.log('Version conflict - file was modified by another process');
 * }
 */
async function writeWithVersionCheck(path, data, expectedVersion) {
  try {
    // Re-read current state to verify version hasn't changed
    if (!fs.existsSync(path)) {
      // File was deleted - this is a conflict
      return { success: false };
    }

    const currentContent = fs.readFileSync(path, 'utf8');
    const current = JSON.parse(currentContent);
    const currentVersion = current.version || 0;

    // Version mismatch - another process modified the file
    if (currentVersion !== expectedVersion) {
      return { success: false };
    }

    // Write atomically using temp file + rename
    // This ensures that readers never see partial writes
    const tempPath = `${path}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');

    // Rename is atomic on most filesystems
    fs.renameSync(tempPath, path);

    return { success: true };
  } catch (error) {
    // Handle any file system errors
    if (error instanceof Error) {
      console.error(`Write error: ${error.message}`);
    }
    return { success: false };
  }
}

/**
 * Release a task claim using optimistic concurrency control.
 *
 * This function releases a task that was previously claimed, allowing other
 * workers to claim it. Uses version checking to prevent race conditions.
 *
 * @param {string} taskPath - Absolute path to the task file
 * @param {string} claimerId - Unique identifier for the claimer (session ID)
 * @returns {Promise<ClaimResult>} Result object indicating success or failure
 *
 * @example
 * const result = await releaseTaskOptimistic('/path/to/task.json', 'session-abc');
 * if (result.success) {
 *   console.log('Released task');
 * }
 */
async function releaseTaskOptimistic(taskPath, claimerId) {
  // Read current task state
  if (!fs.existsSync(taskPath)) {
    return { success: false, reason: 'task_not_found' };
  }

  const content = fs.readFileSync(taskPath, 'utf8');
  /** @type {Task} */
  const task = JSON.parse(content);

  // Check if task is claimed by this claimer
  if (task.claimed_by !== claimerId) {
    return { success: false, reason: 'not_claimed_by_claimer' };
  }

  // Store version for optimistic concurrency control
  const originalVersion = task.version || 0;

  // Prepare update
  task.claimed_by = null;
  task.claimed_at = null;
  task.status = 'open';
  task.version = originalVersion + 1;
  task.updated_at = new Date().toISOString();

  // Atomic write with version check
  const result = await writeWithVersionCheck(taskPath, task, originalVersion);

  if (!result.success) {
    // Version conflict
    return { success: false, reason: 'version_conflict' };
  }

  return { success: true, task };
}

// Export functions
module.exports = {
  claimTaskOptimistic,
  writeWithVersionCheck,
  releaseTaskOptimistic
};
