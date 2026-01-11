#!/usr/bin/env bun

/**
 * Ultrawork Cancel Script
 * Sets phase to CANCELLED, cancelled_at to current timestamp
 */

const fs = require('fs');
const { getSessionFile, readSession, updateSession } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Session} Session
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', alias: '-s', required: true },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Cancel Session
// ============================================================================

/**
 * Cancel a session
 * @param {string} sessionId - Session ID to cancel
 * @returns {Promise<void>}
 */
async function cancelSession(sessionId) {
  const sessionFile = getSessionFile(sessionId);

  if (!fs.existsSync(sessionFile)) {
    console.error(`❌ Session ${sessionId} not found.`);
    process.exit(1);
  }

  /** @type {Session} */
  let session;
  try {
    session = readSession(sessionId);
  } catch (error) {
    console.error(`❌ Failed to read session: ${error}`);
    process.exit(1);
  }

  // Check if already cancelled
  if (session.cancelled_at && session.cancelled_at !== null) {
    console.log(`Session ${sessionId} already cancelled at ${session.cancelled_at}`);
    process.exit(0);
  }

  const timestamp = new Date().toISOString();

  // Update session
  try {
    await updateSession(sessionId, (s) => ({
      ...s,
      phase: 'CANCELLED',
      cancelled_at: timestamp,
      updated_at: timestamp,
    }));
  } catch (error) {
    console.error(`❌ Failed to update session: ${error}`);
    process.exit(1);
  }

  // Output cancellation message
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' ULTRAWORK SESSION CANCELLED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(` Session ID: ${session.session_id}`);
  console.log(` Goal: ${session.goal}`);
  console.log(` Started: ${session.started_at}`);
  console.log(` Cancelled: ${timestamp}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  console.log(' Session history preserved in:');
  console.log(` ${sessionFile}`);
  console.log('');
  console.log(' Start a new session with:');
  console.log(' /ultrawork "your new goal"');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('ultrawork-cancel.js', ARG_SPEC, 'Cancel active ultrawork session and preserve session history'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  const { sessionId } = args;

  await cancelSession(sessionId);
}

main().catch((error) => {
  console.error(`❌ Unexpected error: ${error}`);
  process.exit(1);
});
