/**
 * Session Path Resolution
 * Functions for resolving ultrawork session directory and file paths.
 */

const os = require('os');
const path = require('path');

/**
 * Get the base ultrawork directory
 * Supports ULTRAWORK_TEST_BASE_DIR env var for test isolation
 * @returns {string} ~/.claude/ultrawork (or test override)
 */
function getUltraworkBase() {
  // Allow test override to prevent tests from affecting real user data
  if (process.env.ULTRAWORK_TEST_BASE_DIR) {
    return process.env.ULTRAWORK_TEST_BASE_DIR;
  }
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

module.exports = {
  getUltraworkBase,
  getSessionsDir,
  getSessionDir,
  getSessionFile,
};
