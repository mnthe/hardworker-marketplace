#!/usr/bin/env bun
/**
 * Cross-platform file locking utilities
 * Uses mkdir-based atomic locking for cross-platform compatibility
 * Supports owner identification for reentrant locks and stale lock detection
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const POLL_INTERVAL = 100; // 100ms
const STALE_LOCK_THRESHOLD = 60000; // 1 minute - lock considered stale if holder file older

/**
 * @typedef {Object} LockHolder
 * @property {string} owner - Owner identifier (e.g., session ID)
 * @property {number} pid - Process ID that acquired the lock
 * @property {string} acquired_at - ISO timestamp when lock was acquired
 */

/**
 * Get the holder file path for a lock
 * @param {string} lockPath - Lock directory path
 * @returns {string} Holder file path
 */
function getHolderPath(lockPath) {
  return path.join(lockPath, 'holder.json');
}

/**
 * Write lock holder information
 * @param {string} lockPath - Lock directory path
 * @param {string} owner - Owner identifier
 */
function writeHolder(lockPath, owner) {
  const holderPath = getHolderPath(lockPath);
  const holder = {
    owner,
    pid: process.pid,
    acquired_at: new Date().toISOString()
  };
  fs.writeFileSync(holderPath, JSON.stringify(holder, null, 2), 'utf8');
}

/**
 * Read lock holder information
 * @param {string} lockPath - Lock directory path
 * @returns {LockHolder|null} Holder info or null if not readable
 */
function readHolder(lockPath) {
  try {
    const holderPath = getHolderPath(lockPath);
    const content = fs.readFileSync(holderPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if a lock is stale (holder process may have crashed)
 * @param {string} lockPath - Lock directory path
 * @returns {boolean} True if lock appears stale
 */
function isLockStale(lockPath) {
  const holder = readHolder(lockPath);
  if (!holder) return true; // No holder info = stale

  const acquiredAt = new Date(holder.acquired_at).getTime();
  const age = Date.now() - acquiredAt;

  // If lock is old, check if process is still alive
  if (age > STALE_LOCK_THRESHOLD) {
    try {
      // process.kill(pid, 0) returns true if process exists
      process.kill(holder.pid, 0);
      return false; // Process still alive
    } catch {
      return true; // Process dead = stale lock
    }
  }

  return false;
}

/**
 * Clean up a stale lock
 * @param {string} lockPath - Lock directory path
 */
function cleanStaleLock(lockPath) {
  try {
    const holderPath = getHolderPath(lockPath);
    if (fs.existsSync(holderPath)) {
      fs.unlinkSync(holderPath);
    }
    fs.rmdirSync(lockPath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Acquire a lock on a file using mkdir-based atomic locking.
 * Works across all platforms (Windows, MacOS, Linux).
 * Supports owner identification for reentrant behavior.
 *
 * @param {string} filePath - Path to file to lock
 * @param {string} [owner] - Owner identifier (e.g., session ID). If provided, enables reentrant locks.
 * @param {number} [timeout=10000] - Timeout in milliseconds
 * @returns {Promise<boolean>} True if lock acquired, false if timeout
 */
async function acquireLock(filePath, owner, timeout = DEFAULT_TIMEOUT) {
  // Handle legacy calls: acquireLock(path, timeout)
  if (typeof owner === 'number') {
    timeout = owner;
    owner = undefined;
  }

  const lockPath = `${filePath}.lock`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      fs.mkdirSync(lockPath);
      // Lock acquired - write holder info if owner provided
      if (owner) {
        writeHolder(lockPath, owner);
      }
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock exists - check if it's ours (reentrant) or stale
        if (owner) {
          const holder = readHolder(lockPath);
          if (holder && holder.owner === owner) {
            // Reentrant: we already hold this lock
            return true;
          }
        }

        // Check for stale lock and clean up
        if (isLockStale(lockPath)) {
          cleanStaleLock(lockPath);
          continue; // Retry immediately after cleanup
        }

        // Lock held by another - wait and retry
        await sleep(POLL_INTERVAL);
        continue;
      }
      // Other error, rethrow
      throw err;
    }
  }
  return false;
}

/**
 * Release a file lock.
 * @param {string} filePath - Path to file that was locked
 * @param {string} [owner] - Owner identifier. If provided, only releases if we own the lock.
 * @returns {boolean} True if lock was released, false if not owned by us
 */
function releaseLock(filePath, owner) {
  const lockPath = `${filePath}.lock`;

  try {
    // If owner specified, verify we own the lock
    if (owner) {
      const holder = readHolder(lockPath);
      if (holder && holder.owner !== owner) {
        // Not our lock - don't release
        return false;
      }
    }

    // Remove holder file first
    const holderPath = getHolderPath(lockPath);
    if (fs.existsSync(holderPath)) {
      fs.unlinkSync(holderPath);
    }

    // Remove lock directory
    fs.rmdirSync(lockPath);
    return true;
  } catch {
    // Ignore errors when releasing lock
    return false;
  }
}

/**
 * Get information about who holds a lock.
 * @param {string} filePath - Path to file that may be locked
 * @returns {LockHolder|null} Lock holder info or null if not locked
 */
function getLockHolder(filePath) {
  const lockPath = `${filePath}.lock`;
  if (!fs.existsSync(lockPath)) {
    return null;
  }
  return readHolder(lockPath);
}

/**
 * Check if a file is locked by a specific owner.
 * @param {string} filePath - Path to file to check
 * @param {string} owner - Owner identifier to check
 * @returns {boolean} True if locked by this owner
 */
function isLockedBy(filePath, owner) {
  const holder = getLockHolder(filePath);
  return holder !== null && holder.owner === owner;
}

/**
 * Execute a function with file lock protection.
 * @template T
 * @param {string} filePath - Path to file to lock
 * @param {() => T | Promise<T>} fn - Function to execute while holding lock
 * @param {string} [owner] - Owner identifier for reentrant locks
 * @param {number} [timeout] - Timeout in milliseconds
 * @returns {Promise<T>} Result of function execution
 * @throws {Error} If lock cannot be acquired
 */
async function withLock(filePath, fn, owner, timeout) {
  // Handle legacy calls: withLock(path, fn, timeout)
  if (typeof owner === 'number') {
    timeout = owner;
    owner = undefined;
  }

  const acquired = await acquireLock(filePath, owner, timeout);
  if (!acquired) {
    throw new Error(`Failed to acquire lock for ${filePath}`);
  }
  try {
    return await fn();
  } finally {
    releaseLock(filePath, owner);
  }
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  acquireLock,
  releaseLock,
  withLock,
  getLockHolder,
  isLockedBy,
};
