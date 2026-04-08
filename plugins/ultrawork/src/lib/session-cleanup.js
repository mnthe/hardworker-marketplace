/**
 * Session Cleanup
 * Functions for cleaning up old/stale sessions and validating safe deletion.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { getSessionsDir, getSessionDir } = require('./session-paths.js');
const { isSessionActive } = require('./session-io.js');

/**
 * Validate that a path is safe to delete (prevents accidental deletion of real user data)
 * @param {string} targetPath - Path to validate
 * @throws {Error} If path is not safe to delete
 */
function validateSafeDelete(targetPath) {
  const realUserPath = path.join(os.homedir(), '.claude', 'ultrawork');

  // If we're in test mode, only allow deletion within test directory
  if (process.env.ULTRAWORK_TEST_BASE_DIR) {
    const testBase = path.resolve(process.env.ULTRAWORK_TEST_BASE_DIR);
    const resolvedTarget = path.resolve(targetPath);

    if (!resolvedTarget.startsWith(testBase + path.sep) && resolvedTarget !== testBase) {
      throw new Error(
        `SAFETY: Attempted to delete outside test directory.\n` +
        `  Test base: ${testBase}\n` +
        `  Target: ${resolvedTarget}\n` +
        `  This is a bug in the test code.`
      );
    }
  }

  // Prevent deletion of the base ultrawork directory itself
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(realUserPath);

  if (resolvedTarget === resolvedBase || resolvedTarget === path.dirname(resolvedBase)) {
    throw new Error(
      `SAFETY: Attempted to delete ultrawork base directory.\n` +
      `  Target: ${resolvedTarget}\n` +
      `  This would delete all ultrawork data!`
    );
  }
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
      validateSafeDelete(sessionDir);
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  }
}

module.exports = {
  validateSafeDelete,
  cleanupOldSessions,
};
