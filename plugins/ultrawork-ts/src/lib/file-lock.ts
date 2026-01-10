import * as fs from 'fs';

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const POLL_INTERVAL = 100; // 100ms

/**
 * Acquire a lock on a file using mkdir-based atomic locking.
 * Same approach as bash version but cross-platform compatible.
 */
export async function acquireLock(filePath: string, timeout: number = DEFAULT_TIMEOUT): Promise<boolean> {
  const lockPath = `${filePath}.lock`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      fs.mkdirSync(lockPath);
      return true;
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EEXIST') {
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
 */
export function releaseLock(filePath: string): void {
  const lockPath = `${filePath}.lock`;
  try {
    fs.rmdirSync(lockPath);
  } catch {
    // Ignore errors when releasing lock
  }
}

/**
 * Execute a function with file lock protection.
 */
export async function withLock<T>(
  filePath: string,
  fn: () => T | Promise<T>,
  timeout?: number
): Promise<T> {
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
