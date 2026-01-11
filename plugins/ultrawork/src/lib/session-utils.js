/**
 * Ultrawork Session Utilities
 * Common functions for session ID management
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { acquireLock, releaseLock } = require('./file-lock');

// Import types for JSDoc
/**
 * @typedef {import('./types').Session} Session
 * @typedef {import('./types').Phase} Phase
 */

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Get the base ultrawork directory
 * @returns {string} ~/.claude/ultrawork
 */
function getUltraworkBase() {
  return path.join(os.homedir(), '.claude', 'ultrawork');
}

/**
 * Get sessions directory
 * @returns {string} ~/.claude/ultrawork/sessions
 */
function getSessionsDir() {
  return path.join(getUltraworkBase(), 'sessions');
}

/**
 * Get session directory for a session ID
 * @param {string} sessionId - Session ID
 * @returns {string} Session directory path
 */
function getSessionDir(sessionId) {
  return path.join(getSessionsDir(), sessionId);
}

/**
 * Get session.json path for a session ID
 * @param {string} sessionId - Session ID
 * @returns {string} Session file path
 */
function getSessionFile(sessionId) {
  return path.join(getSessionDir(sessionId), 'session.json');
}

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Validate session ID and return session file path
 * @param {string} sessionId - Session ID
 * @returns {string} Session file path
 * @throws {Error} If session doesn't exist
 */
function resolveSessionId(sessionId) {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  const sessionFile = getSessionFile(sessionId);

  if (!fs.existsSync(sessionFile)) {
    throw new Error(
      `Session not found: ${sessionId}\nExpected file: ${sessionFile}`
    );
  }

  return sessionFile;
}

/**
 * Check if session exists and is active (not in terminal state)
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if session is active
 */
function isSessionActive(sessionId) {
  const sessionFile = getSessionFile(sessionId);

  if (!fs.existsSync(sessionFile)) {
    return false;
  }

  try {
    const content = fs.readFileSync(sessionFile, 'utf-8');
    /** @type {Session} */
    const session = JSON.parse(content);
    const phase = session.phase || 'unknown';

    // Active phases
    /** @type {Phase[]} */
    const activePhases = ['PLANNING', 'EXECUTION', 'VERIFICATION'];
    return activePhases.includes(phase);
  } catch {
    return false;
  }
}

/**
 * List all active sessions (scans all session directories)
 * @returns {string[]} Array of active session IDs
 */
function listActiveSessions() {
  const sessionsDir = getSessionsDir();

  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  /** @type {string[]} */
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
 * @param {string} sessionId - Session ID
 * @returns {Session} Session data
 */
function readSession(sessionId) {
  const sessionFile = resolveSessionId(sessionId);
  const content = fs.readFileSync(sessionFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Update session data with file locking
 * Uses an updater function to transform the session
 * @param {string} sessionId - Session ID
 * @param {(session: Session) => Session} updater - Function to transform session
 * @returns {Promise<void>}
 */
async function updateSession(sessionId, updater) {
  const sessionFile = resolveSessionId(sessionId);

  const acquired = await acquireLock(sessionFile);
  if (!acquired) {
    throw new Error(`Failed to acquire lock for session ${sessionId}`);
  }

  try {
    // Read current session
    const content = fs.readFileSync(sessionFile, 'utf-8');
    /** @type {Session} */
    const session = JSON.parse(content);

    // Apply update
    const updated = updater(session);

    // Update timestamp
    updated.updated_at = new Date().toISOString();

    // Write atomically using temp file
    const tmpFile = `${sessionFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(updated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, sessionFile);
  } finally {
    releaseLock(sessionFile);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Claude session_id from environment variable
 * Hooks set ULTRAWORK_STDIN_SESSION_ID before calling scripts
 * @returns {string | undefined} Session ID from environment
 */
function getClaudeSessionId() {
  return process.env.ULTRAWORK_STDIN_SESSION_ID || undefined;
}

/**
 * Get session.json path for current session from environment
 * @returns {string | undefined} Session file path or undefined
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
 * @param {number} [days=7] - Number of days to keep sessions
 * @returns {void}
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
 * @returns {string | undefined} Session ID from environment
 */
function getCurrentSessionId() {
  return getClaudeSessionId();
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  getUltraworkBase,
  getSessionsDir,
  getSessionDir,
  getSessionFile,
  resolveSessionId,
  isSessionActive,
  listActiveSessions,
  readSession,
  updateSession,
  getClaudeSessionId,
  getCurrentSessionFile,
  cleanupOldSessions,
  getCurrentSessionId,
};
