"use strict";
/**
 * Ultrawork Session Utilities
 * Common functions for session ID management
 * TypeScript port of session-utils.sh
 */
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
exports.getUltraworkBase = getUltraworkBase;
exports.getSessionsDir = getSessionsDir;
exports.getSessionDir = getSessionDir;
exports.getSessionFile = getSessionFile;
exports.resolveSessionId = resolveSessionId;
exports.isSessionActive = isSessionActive;
exports.listActiveSessions = listActiveSessions;
exports.readSession = readSession;
exports.updateSession = updateSession;
exports.getClaudeSessionId = getClaudeSessionId;
exports.getCurrentSessionFile = getCurrentSessionFile;
exports.cleanupOldSessions = cleanupOldSessions;
exports.getCurrentSessionId = getCurrentSessionId;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const file_lock_1 = require("./file-lock");
// ============================================================================
// Path Resolution
// ============================================================================
/**
 * Get the base ultrawork directory
 * Returns: ~/.claude/ultrawork
 */
function getUltraworkBase() {
    return path.join(os.homedir(), '.claude', 'ultrawork');
}
/**
 * Get sessions directory
 * Returns: ~/.claude/ultrawork/sessions
 */
function getSessionsDir() {
    return path.join(getUltraworkBase(), 'sessions');
}
/**
 * Get session directory for a session ID
 */
function getSessionDir(sessionId) {
    return path.join(getSessionsDir(), sessionId);
}
/**
 * Get session.json path for a session ID
 */
function getSessionFile(sessionId) {
    return path.join(getSessionDir(sessionId), 'session.json');
}
// ============================================================================
// Session Validation
// ============================================================================
/**
 * Validate session ID and return session file path
 * Throws error if session doesn't exist
 */
function resolveSessionId(sessionId) {
    if (!sessionId) {
        throw new Error('Session ID is required');
    }
    const sessionFile = getSessionFile(sessionId);
    if (!fs.existsSync(sessionFile)) {
        throw new Error(`Session not found: ${sessionId}\nExpected file: ${sessionFile}`);
    }
    return sessionFile;
}
/**
 * Check if session exists and is active (not in terminal state)
 */
function isSessionActive(sessionId) {
    const sessionFile = getSessionFile(sessionId);
    if (!fs.existsSync(sessionFile)) {
        return false;
    }
    try {
        const content = fs.readFileSync(sessionFile, 'utf-8');
        const session = JSON.parse(content);
        const phase = session.phase || 'unknown';
        // Active phases
        const activePhases = ['PLANNING', 'EXECUTION', 'VERIFICATION'];
        return activePhases.includes(phase);
    }
    catch {
        return false;
    }
}
/**
 * List all active sessions (scans all session directories)
 */
function listActiveSessions() {
    const sessionsDir = getSessionsDir();
    if (!fs.existsSync(sessionsDir)) {
        return [];
    }
    const sessions = [];
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const sessionId = entry.name;
            if (isSessionActive(sessionId)) {
                sessions.push(sessionId);
            }
        }
    }
    return sessions;
}
// ============================================================================
// JSON Operations with Locking
// ============================================================================
/**
 * Read session data with proper error handling
 */
function readSession(sessionId) {
    const sessionFile = resolveSessionId(sessionId);
    const content = fs.readFileSync(sessionFile, 'utf-8');
    return JSON.parse(content);
}
/**
 * Update session data with file locking
 * Uses an updater function to transform the session
 */
async function updateSession(sessionId, updater) {
    const sessionFile = resolveSessionId(sessionId);
    const acquired = await (0, file_lock_1.acquireLock)(sessionFile);
    if (!acquired) {
        throw new Error(`Failed to acquire lock for session ${sessionId}`);
    }
    try {
        // Read current session
        const content = fs.readFileSync(sessionFile, 'utf-8');
        const session = JSON.parse(content);
        // Apply update
        const updated = updater(session);
        // Update timestamp
        updated.updated_at = new Date().toISOString();
        // Write atomically using temp file
        const tmpFile = `${sessionFile}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(updated, null, 2), 'utf-8');
        fs.renameSync(tmpFile, sessionFile);
    }
    finally {
        (0, file_lock_1.releaseLock)(sessionFile);
    }
}
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Get Claude session_id from environment variable
 * Hooks set ULTRAWORK_STDIN_SESSION_ID before calling scripts
 */
function getClaudeSessionId() {
    return process.env.ULTRAWORK_STDIN_SESSION_ID || undefined;
}
/**
 * Get session.json path for current session from environment
 */
function getCurrentSessionFile() {
    const sessionId = getClaudeSessionId();
    if (!sessionId) {
        return undefined;
    }
    const sessionFile = getSessionFile(sessionId);
    return fs.existsSync(sessionFile) ? sessionFile : undefined;
}
/**
 * Clean up old sessions (completed/cancelled/failed older than N days)
 */
function cleanupOldSessions(days = 7) {
    const sessionsDir = getSessionsDir();
    if (!fs.existsSync(sessionsDir)) {
        return;
    }
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const sessionId = entry.name;
        const sessionDir = getSessionDir(sessionId);
        // Check directory modification time
        const stats = fs.statSync(sessionDir);
        if (stats.mtimeMs > cutoffTime) {
            continue;
        }
        // Only delete non-active sessions
        if (!isSessionActive(sessionId)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
    }
}
// ============================================================================
// Backward Compatibility Aliases
// ============================================================================
/**
 * Alias for getClaudeSessionId (backward compatibility)
 */
function getCurrentSessionId() {
    return getClaudeSessionId();
}
//# sourceMappingURL=session-utils.js.map