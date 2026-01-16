#!/usr/bin/env bun

/**
 * Ultrawork Status Script
 * Displays formatted session status (phase, goal, iteration, tasks summary)
 */

const fs = require('fs');
const path = require('path');
const {
  getSessionsDir,
  getSessionDir,
  getSessionFile,
  readSession,
} = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Session} Session
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'] },
  '--all': { key: 'listAll', aliases: ['-a'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// List All Sessions
// ============================================================================

/**
 * List all sessions
 * @returns {void}
 */
function listAllSessions() {
  const sessionsDir = getSessionsDir();

  console.log('═══════════════════════════════════════════════════════════');
  console.log(' ALL ULTRAWORK SESSIONS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  let sessionCount = 0;

  if (!fs.existsSync(sessionsDir)) {
    console.log(' No sessions found.');
    console.log('');
    console.log(' Start one with: /ultrawork "your goal"');
    console.log('═══════════════════════════════════════════════════════════');
    return;
  }

  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sessionId = entry.name;
    const sessionFile = getSessionFile(sessionId);

    if (!fs.existsSync(sessionFile)) {
      continue;
    }

    try {
      const session = readSession(sessionId);

      console.log(` [${sessionId}]`);
      console.log(`   Goal: ${session.goal}`);
      console.log(`   Phase: ${session.phase}`);
      console.log(`   Started: ${session.started_at}`);
      console.log('');

      sessionCount++;
    } catch (error) {
      // Skip invalid sessions
      continue;
    }
  }

  if (sessionCount === 0) {
    console.log(' No sessions found.');
    console.log('');
    console.log(' Start one with: /ultrawork "your goal"');
  } else {
    console.log('───────────────────────────────────────────────────────────');
    console.log(` Total: ${sessionCount} session(s)`);
  }

  console.log('═══════════════════════════════════════════════════════════');
}

// ============================================================================
// Show Session Status
// ============================================================================

/**
 * Show session status
 * @param {string} sessionId - Session ID
 * @returns {void}
 */
function showSessionStatus(sessionId) {
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

  const sessionDir = getSessionDir(sessionId);

  // Count tasks
  const tasksDir = path.join(sessionDir, 'tasks');
  let taskCount = 0;
  if (fs.existsSync(tasksDir)) {
    const taskFiles = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.json'));
    taskCount = taskFiles.length;
  }

  // Count evidence
  const evidenceCount = session.evidence_log?.length || 0;

  // Output status
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' ULTRAWORK SESSION STATUS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(` Session ID: ${session.session_id}`);
  console.log(` Goal: ${session.goal}`);
  console.log(` Phase: ${session.phase}`);
  console.log(` Exploration: ${session.exploration_stage}`);
  console.log(` Started: ${session.started_at}`);
  console.log(` Updated: ${session.updated_at}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log(' WORKFLOW');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');

  // Show phase progress
  const phase = session.phase;

  if (phase === 'PLANNING') {
    console.log(` 1. [→] PLANNING     - Exploration: ${session.exploration_stage}`);
    console.log(' 2. [ ] EXECUTION    - Workers implementing tasks');
    console.log(' 3. [ ] VERIFICATION - Verifier checking evidence');
    console.log(' 4. [ ] COMPLETE     - All criteria met');
  } else if (phase === 'EXECUTION') {
    console.log(' 1. [✓] PLANNING     - Task graph created');
    console.log(' 2. [→] EXECUTION    - Workers implementing tasks');
    console.log(' 3. [ ] VERIFICATION - Verifier checking evidence');
    console.log(' 4. [ ] COMPLETE     - All criteria met');
  } else if (phase === 'VERIFICATION') {
    console.log(' 1. [✓] PLANNING     - Task graph created');
    console.log(' 2. [✓] EXECUTION    - Tasks implemented');
    console.log(' 3. [→] VERIFICATION - Verifier checking evidence');
    console.log(' 4. [ ] COMPLETE     - All criteria met');
  } else if (phase === 'COMPLETE') {
    console.log(' 1. [✓] PLANNING     - Task graph created');
    console.log(' 2. [✓] EXECUTION    - Tasks implemented');
    console.log(' 3. [✓] VERIFICATION - Evidence verified');
    console.log(' 4. [✓] COMPLETE     - All criteria met');
  } else if (phase === 'CANCELLED') {
    console.log(' Session was cancelled by user');
  } else if (phase === 'FAILED') {
    console.log(' Session failed - check failure_reason in session.json');
  }

  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log(' STATS');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  console.log(` Tasks: ${taskCount}`);
  console.log(` Evidence items: ${evidenceCount}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log(' SESSION DIRECTORY');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  console.log(` ${sessionDir}/`);
  console.log('   ├── session.json');
  console.log('   ├── context.json');
  console.log('   ├── exploration/');
  console.log('   └── tasks/');
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  console.log(' /ultrawork-evidence - View detailed evidence');
  console.log(' /ultrawork-clean    - Clean up session');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('ultrawork-status.js', ARG_SPEC, 'Display formatted session status with phase, tasks, and evidence summary'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  if (args.listAll) {
    listAllSessions();
    process.exit(0);
  }

  if (!args.sessionId) {
    console.error('❌ Error: --session is required');
    process.exit(1);
  }

  const { sessionId } = args;

  showSessionStatus(sessionId);
}

main();
