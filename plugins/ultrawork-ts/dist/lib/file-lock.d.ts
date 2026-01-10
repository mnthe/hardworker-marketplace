/**
 * Acquire a lock on a file using mkdir-based atomic locking.
 * Same approach as bash version but cross-platform compatible.
 */
export declare function acquireLock(filePath: string, timeout?: number): Promise<boolean>;
/**
 * Release a file lock.
 */
export declare function releaseLock(filePath: string): void;
/**
 * Execute a function with file lock protection.
 */
export declare function withLock<T>(filePath: string, fn: () => T | Promise<T>, timeout?: number): Promise<T>;
//# sourceMappingURL=file-lock.d.ts.map