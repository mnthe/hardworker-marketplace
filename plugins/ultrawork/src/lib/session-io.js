/**
 * Session I/O Operations
 * Read/write operations for session JSON files with locking and optimized field extraction.
 */

const fs = require('fs');
const { getSessionFile, getSessionsDir } = require('./session-paths.js');
const { acquireLock, releaseLock } = require('./file-lock');
const { writeJsonAtomically } = require('./json-ops');

// Import types for JSDoc
/**
 * @typedef {import('./types').Session} Session
 * @typedef {import('./types').Phase} Phase
 */

// ============================================================================
// Optimized Field Extraction (consolidated from session-field.js)
// ============================================================================

/**
 * Top-level fields that can be extracted via regex (simple string/number/boolean)
 */
const TOP_LEVEL_SIMPLE_FIELDS = new Set([
  'version', 'session_id', 'working_dir', 'goal', 'phase',
  'exploration_stage', 'iteration', 'started_at', 'updated_at', 'cancelled_at'
]);

/**
 * Extract a top-level simple field using regex (avoids full JSON parse).
 * Only works for string, number, boolean, null values.
 *
 * @param {string} content - File content (partial or full)
 * @param {string} fieldName - Field name to extract
 * @returns {string | number | boolean | null | undefined} Extracted value or undefined
 */
function extractTopLevelField(content, fieldName) {
  const pattern = new RegExp(
    `"${fieldName}"\\s*:\\s*("([^"\\\\]*(\\\\.[^"\\\\]*)*)"|(-?\\d+\\.?\\d*)|true|false|null)`,
    'm'
  );

  const match = content.match(pattern);
  if (!match) return undefined;

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

/**
 * Get field value from nested object using dot notation
 * @param {any} obj - Object to query
 * @param {string} fieldPath - Dot-separated field path
 * @returns {any} Field value or undefined
 */
function getNestedField(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let value = obj;

  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = value[part];
  }

  return value;
}

// ============================================================================
// Session Validation Helpers (used by I/O functions)
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

// ============================================================================
// Session Read Operations
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
 * Optimized field extraction from session JSON.
 * For simple top-level fields, uses partial file read + regex.
 * For nested/complex fields, falls back to full JSON parse.
 *
 * @param {string} sessionId - Session ID
 * @param {string} fieldPath - Field path (dot notation for nested)
 * @returns {any} Field value or undefined
 */
function readSessionField(sessionId, fieldPath) {
  const sessionFile = resolveSessionId(sessionId);

  const isTopLevel = !fieldPath.includes('.');
  const fieldName = isTopLevel ? fieldPath : fieldPath.split('.')[0];

  // Optimization: for known simple top-level fields, read partial file
  if (isTopLevel && TOP_LEVEL_SIMPLE_FIELDS.has(fieldName)) {
    const fd = fs.openSync(sessionFile, 'r');
    const buffer = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);

    const partialContent = buffer.toString('utf-8', 0, bytesRead);
    const value = extractTopLevelField(partialContent, fieldName);

    if (value !== undefined) {
      return value;
    }
    // Fall through to full parse if not found
  }

  // Full parse for nested or complex fields
  const content = fs.readFileSync(sessionFile, 'utf-8');
  const session = JSON.parse(content);

  return getNestedField(session, fieldPath);
}

/**
 * Extract field from a session file path with optimized reading.
 * Returns both value and optimization flag.
 *
 * @param {string} sessionFile - Path to session.json
 * @param {string} fieldPath - Field path (dot notation for nested)
 * @returns {{ value: any, optimized: boolean }} Result with optimization flag
 */
function extractField(sessionFile, fieldPath) {
  const isTopLevel = !fieldPath.includes('.');
  const fieldName = isTopLevel ? fieldPath : fieldPath.split('.')[0];

  // Optimization: for known simple top-level fields, read partial file
  if (isTopLevel && TOP_LEVEL_SIMPLE_FIELDS.has(fieldName)) {
    const fd = fs.openSync(sessionFile, 'r');
    const buffer = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);

    const partialContent = buffer.toString('utf-8', 0, bytesRead);
    const value = extractTopLevelField(partialContent, fieldName);

    if (value !== undefined) {
      return { value, optimized: true };
    }
    // Fall through to full parse if not found in partial
  }

  // Full parse for nested fields or complex values
  const content = fs.readFileSync(sessionFile, 'utf-8');
  const session = JSON.parse(content);
  const value = getNestedField(session, fieldPath);

  return { value, optimized: false };
}

// ============================================================================
// Session Write Operations
// ============================================================================

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
    writeJsonAtomically(sessionFile, updated);
  } finally {
    releaseLock(sessionFile);
  }
}

// ============================================================================
// Session Query Operations
// ============================================================================

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
    const activePhases = ['PLANNING', 'EXECUTION', 'VERIFICATION', 'DOCUMENTATION'];
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
// Environment Helpers
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
 * Alias for getClaudeSessionId (backward compatibility)
 * @returns {string | undefined} Session ID from environment
 */
function getCurrentSessionId() {
  return getClaudeSessionId();
}

/**
 * Check if current path is a test directory (safe to delete)
 * @returns {boolean} True if running in test mode with test directory
 */
function isTestDirectory() {
  return !!process.env.ULTRAWORK_TEST_BASE_DIR;
}

module.exports = {
  // Field extraction (consolidated)
  TOP_LEVEL_SIMPLE_FIELDS,
  extractTopLevelField,
  getNestedField,
  extractField,
  // Session validation
  resolveSessionId,
  // Read operations
  readSession,
  readSessionField,
  // Write operations
  updateSession,
  // Query operations
  isSessionActive,
  listActiveSessions,
  // Environment helpers
  getClaudeSessionId,
  getCurrentSessionFile,
  getCurrentSessionId,
  isTestDirectory,
};
