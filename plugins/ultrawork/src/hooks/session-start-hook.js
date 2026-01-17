#!/usr/bin/env bun

/**
 * SessionStart Hook - Cleanup old ultrawork sessions and provide session ID
 * v1.0: JavaScript version with JSDoc types
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { readStdin, createSessionStart, runHook } = require('../lib/hook-utils.js');

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 */

/**
 * @typedef {Object} SessionData
 * @property {string} [phase]
 */

/**
 * Cleanup old sessions (completed/cancelled/failed older than 7 days)
 * @returns {void}
 */
function cleanupOldSessions() {
  const sessionsDir = path.join(os.homedir(), '.claude', 'ultrawork', 'sessions');

  if (!fs.existsSync(sessionsDir)) {
    return;
  }

  try {
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
    const sessionDirs = entries.filter(e => e.isDirectory());

    // Only cleanup if there are more than 10 sessions
    if (sessionDirs.length <= 10) {
      return;
    }

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const entry of sessionDirs) {
      const sessionPath = path.join(sessionsDir, entry.name);
      const sessionJsonPath = path.join(sessionPath, 'session.json');

      if (!fs.existsSync(sessionJsonPath)) {
        continue;
      }

      // Check if directory is older than 7 days
      const stats = fs.statSync(sessionPath);
      if (stats.mtimeMs > sevenDaysAgo) {
        continue;
      }

      // Check if session is in terminal state
      try {
        /** @type {SessionData} */
        const sessionData = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
        const phase = sessionData.phase || '';

        if (phase === 'COMPLETE' || phase === 'CANCELLED' || phase === 'FAILED') {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (err) {
        // Ignore parse errors, just skip this session
        continue;
      }
    }
  } catch (err) {
    // Silently ignore cleanup errors
  }
}

/**
 * Main hook logic
 * @returns {Promise<void>}
 */
async function main() {
  // Read stdin JSON
  const input = await readStdin();
  /** @type {HookInput} */
  const hookInput = JSON.parse(input);

  // Extract session_id
  const sessionId = hookInput.session_id;

  // Cleanup old sessions
  cleanupOldSessions();

  // Output session ID for AI to use
  const systemMessage = sessionId
    ? `CLAUDE_SESSION_ID: ${sessionId}`
    : undefined;

  const output = createSessionStart(systemMessage);
  console.log(JSON.stringify(output));
  process.exit(0);
}

// Entry point
runHook(main, () => ({}));
