#!/usr/bin/env bun

/**
 * Ultrawork Clean Script
 *
 * Two modes:
 * 1. Single session clean (no batch flags): Delete current session for fresh /ultrawork start
 * 2. Batch cleanup (with --all, --completed, --older-than): Delete multiple sessions
 */

const fs = require('fs');
const { getSessionsDir, getSessionDir, readSessionField, validateSafeDelete } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Argument Parsing
// ============================================================================

const ARG_SPEC = {
  '--session': { key: 'session' },
  '--all': { key: 'all', flag: true },
  '--completed': { key: 'completed', flag: true },
  '--older-than': { key: 'olderThan' },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Constants
// ============================================================================

/** @type {string[]} */
const TERMINAL_STATES = ['COMPLETE', 'CANCELLED', 'FAILED'];

const DEFAULT_DAYS = 7;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate age of session in days
 * @param {string} sessionDir - Session directory path
 * @returns {number} Age in days
 */
function getSessionAgeDays(sessionDir) {
  try {
    const stats = fs.statSync(sessionDir);
    const ageMs = Date.now() - stats.mtimeMs;
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Get session metadata for output
 * @param {string} sessionId - Session ID
 * @param {string} sessionDir - Session directory path
 * @returns {{session_id: string, goal: string, phase: string, age_days: number}}
 */
function getSessionMetadata(sessionId, sessionDir) {
  try {
    const goal = readSessionField(sessionId, 'goal') || 'unknown';
    const phase = readSessionField(sessionId, 'phase') || 'unknown';
    const ageDays = getSessionAgeDays(sessionDir);

    return {
      session_id: sessionId,
      goal,
      phase,
      age_days: ageDays
    };
  } catch {
    return {
      session_id: sessionId,
      goal: 'unknown',
      phase: 'unknown',
      age_days: getSessionAgeDays(sessionDir)
    };
  }
}

/**
 * Check if session should be deleted based on mode
 * @param {string} phase - Session phase
 * @param {number} ageDays - Session age in days
 * @param {Object} mode - Cleanup mode
 * @returns {boolean} True if session should be deleted
 */
function shouldDeleteSession(phase, ageDays, mode) {
  // --all mode: delete everything
  if (mode.all) {
    return true;
  }

  // --completed mode: delete all terminal states
  if (mode.completed) {
    return TERMINAL_STATES.includes(phase);
  }

  // --older-than mode (default): delete terminal states older than N days
  const days = mode.olderThan ? parseInt(mode.olderThan, 10) : DEFAULT_DAYS;
  return TERMINAL_STATES.includes(phase) && ageDays > days;
}

// ============================================================================
// Single Session Clean
// ============================================================================

/**
 * Clean a single session (delete entire session directory)
 * @param {string} sessionId - Session ID to clean
 * @returns {{success: boolean, session_id: string, message: string}}
 */
function cleanSingleSession(sessionId) {
  const sessionDir = getSessionDir(sessionId);

  if (!fs.existsSync(sessionDir)) {
    return {
      success: true,
      session_id: sessionId,
      message: 'Session does not exist (already clean)'
    };
  }

  try {
    const metadata = getSessionMetadata(sessionId, sessionDir);

    // Safety check: prevent accidental deletion of wrong directories
    validateSafeDelete(sessionDir);

    fs.rmSync(sessionDir, { recursive: true, force: true });

    return {
      success: true,
      session_id: sessionId,
      goal: metadata.goal,
      phase: metadata.phase,
      message: 'Session deleted. Run /ultrawork to start fresh.'
    };
  } catch (error) {
    return {
      success: false,
      session_id: sessionId,
      message: `Failed to delete session: ${error.message}`
    };
  }
}

// ============================================================================
// Batch Clean Sessions
// ============================================================================

/**
 * Clean sessions based on mode (batch cleanup)
 * @param {Object} mode - Cleanup mode options
 * @returns {{deleted_count: number, deleted_sessions: Array, preserved_count: number}}
 */
function cleanSessions(mode) {
  const sessionsDir = getSessionsDir();

  if (!fs.existsSync(sessionsDir)) {
    return {
      deleted_count: 0,
      deleted_sessions: [],
      preserved_count: 0
    };
  }

  const deletedSessions = [];
  let preservedCount = 0;

  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sessionId = entry.name;
    const sessionDir = getSessionDir(sessionId);
    const metadata = getSessionMetadata(sessionId, sessionDir);

    if (shouldDeleteSession(metadata.phase, metadata.age_days, mode)) {
      try {
        // Safety check: prevent accidental deletion of wrong directories
        validateSafeDelete(sessionDir);

        fs.rmSync(sessionDir, { recursive: true, force: true });
        deletedSessions.push(metadata);
      } catch (error) {
        console.error(`Failed to delete session ${sessionId}: ${error.message}`);
      }
    } else {
      preservedCount++;
    }
  }

  return {
    deleted_count: deletedSessions.length,
    deleted_sessions: deletedSessions,
    preserved_count: preservedCount
  };
}

// ============================================================================
// Main
// ============================================================================

/**
 * Check if any batch cleanup flags are specified
 * @param {Object} args - Parsed arguments
 * @returns {boolean} True if batch mode
 */
function isBatchMode(args) {
  return args.all || args.completed || args.olderThan;
}

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    const helpText = generateHelp(
      'ultrawork-clean.js',
      ARG_SPEC,
      'Clean ultrawork sessions.\n\n' +
      'Single session mode (default):\n' +
      '  --session ID    Clean specific session (default: CLAUDE_SESSION_ID)\n' +
      '                  Deletes entire session directory for fresh /ultrawork start\n\n' +
      'Batch cleanup mode:\n' +
      '  --older-than N  Delete sessions older than N days in terminal states\n' +
      '  --completed     Delete all sessions in terminal states (COMPLETE, CANCELLED, FAILED)\n' +
      '  --all           Delete ALL sessions including active ones\n\n' +
      'Terminal states: COMPLETE, CANCELLED, FAILED\n' +
      'Active states: PLANNING, EXECUTION, VERIFICATION'
    );
    console.log(helpText);
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Check if batch mode or single session mode
  if (isBatchMode(args)) {
    // Batch cleanup mode
    const mode = {
      all: args.all || false,
      completed: args.completed || false,
      olderThan: args.olderThan
    };

    const result = cleanSessions(mode);
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Single session mode
    const sessionId = args.session || process.env.CLAUDE_SESSION_ID;

    if (!sessionId) {
      console.error('Error: --session required (or set CLAUDE_SESSION_ID)');
      process.exit(1);
    }

    const result = cleanSingleSession(sessionId);
    console.log(JSON.stringify(result, null, 2));

    if (!result.success) {
      process.exit(1);
    }
  }
}

main();
