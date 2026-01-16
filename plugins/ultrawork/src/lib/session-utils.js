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
    // Optimized: read only first 1KB to extract phase field
    const fd = fs.openSync(sessionFile, 'r');
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);

    const partialContent = buffer.toString('utf-8', 0, bytesRead);

    // Extract phase using regex
    const match = partialContent.match(/"phase"\s*:\s*"([^"]+)"/);
    const phase = match ? match[1] : 'unknown';

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
 * Optimized field extraction from session JSON
 * For simple top-level fields, uses partial file read + regex
 * @param {string} sessionId - Session ID
 * @param {string} fieldPath - Field path (dot notation for nested)
 * @returns {any} Field value or undefined
 */
function readSessionField(sessionId, fieldPath) {
  const sessionFile = resolveSessionId(sessionId);

  // Top-level fields that can be extracted via regex
  const topLevelSimpleFields = new Set([
    'version', 'session_id', 'working_dir', 'goal', 'phase',
    'exploration_stage', 'iteration', 'started_at', 'updated_at', 'cancelled_at'
  ]);

  const isTopLevel = !fieldPath.includes('.');
  const fieldName = isTopLevel ? fieldPath : fieldPath.split('.')[0];

  // Optimization: for known simple top-level fields, read partial file
  if (isTopLevel && topLevelSimpleFields.has(fieldName)) {
    const fd = fs.openSync(sessionFile, 'r');
    const buffer = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);

    const partialContent = buffer.toString('utf-8', 0, bytesRead);

    // Extract field using regex
    const pattern = new RegExp(
      `"${fieldName}"\\s*:\\s*("([^"\\\\]*(\\\\.[^"\\\\]*)*)"|(-?\\d+\\.?\\d*)|true|false|null)`,
      'm'
    );

    const match = partialContent.match(pattern);
    if (match) {
      const rawValue = match[1];
      if (rawValue.startsWith('"')) {
        return rawValue.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      } else if (rawValue === 'true') {
        return true;
      } else if (rawValue === 'false') {
        return false;
      } else if (rawValue === 'null') {
        return null;
      } else {
        return parseFloat(rawValue);
      }
    }
    // Fall through to full parse if not found
  }

  // Full parse for nested or complex fields
  const content = fs.readFileSync(sessionFile, 'utf-8');
  const session = JSON.parse(content);

  const parts = fieldPath.split('.');
  let value = session;
  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = value[part];
  }

  return value;
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
  readSessionField,
  updateSession,
  getClaudeSessionId,
  getCurrentSessionFile,
  cleanupOldSessions,
  getCurrentSessionId,
};
