/**
 * Cross-platform file locking utilities
 * Uses mkdir-based atomic locking, same approach as bash version
 */

const fs = require('fs');

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const POLL_INTERVAL = 100; // 100ms

/**
 * Acquire a lock on a file using mkdir-based atomic locking.
 * Same approach as bash version but cross-platform compatible.
 * @param {string} filePath - Path to file to lock
 * @param {number} [timeout=10000] - Timeout in milliseconds
 * @returns {Promise<boolean>} True if lock acquired, false if timeout
 */
async function acquireLock(filePath, timeout = DEFAULT_TIMEOUT) {
  const lockPath = `${filePath}.lock`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      fs.mkdirSync(lockPath);
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock exists, wait and retry
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
 * @returns {void}
 */
function releaseLock(filePath) {
  const lockPath = `${filePath}.lock`;
  try {
    fs.rmdirSync(lockPath);
  } catch {
    // Ignore errors when releasing lock
  }
}

/**
 * Execute a function with file lock protection.
 * @template T
 * @param {string} filePath - Path to file to lock
 * @param {() => T | Promise<T>} fn - Function to execute while holding lock
 * @param {number} [timeout] - Timeout in milliseconds
 * @returns {Promise<T>} Result of function execution
 * @throws {Error} If lock cannot be acquired
 */
async function withLock(filePath, fn, timeout) {
  const acquired = await acquireLock(filePath, timeout);
  if (!acquired) {
    throw new Error(`Failed to acquire lock for ${filePath}`);
  }
  try {
    return await fn();
  } finally {
    releaseLock(filePath);
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
};
