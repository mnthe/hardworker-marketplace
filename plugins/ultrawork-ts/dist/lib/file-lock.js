"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireLock = acquireLock;
exports.releaseLock = releaseLock;
exports.withLock = withLock;
const fs = __importStar(require("fs"));
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const POLL_INTERVAL = 100; // 100ms
/**
 * Acquire a lock on a file using mkdir-based atomic locking.
 * Same approach as bash version but cross-platform compatible.
 */
async function acquireLock(filePath, timeout = DEFAULT_TIMEOUT) {
    const lockPath = `${filePath}.lock`;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            fs.mkdirSync(lockPath);
            return true;
        }
        catch (err) {
            const error = err;
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
function releaseLock(filePath) {
    const lockPath = `${filePath}.lock`;
    try {
        fs.rmdirSync(lockPath);
    }
    catch {
        // Ignore errors when releasing lock
    }
}
/**
 * Execute a function with file lock protection.
 */
async function withLock(filePath, fn, timeout) {
    const acquired = await acquireLock(filePath, timeout);
    if (!acquired) {
        throw new Error(`Failed to acquire lock for ${filePath}`);
    }
    try {
        return await fn();
    }
    finally {
        releaseLock(filePath);
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=file-lock.js.map