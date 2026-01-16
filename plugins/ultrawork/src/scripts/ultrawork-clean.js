#!/usr/bin/env bun

/**
 * Ultrawork Clean Script
 * Delete sessions based on cleanup mode (--all, --completed, --older-than)
 */

const fs = require('fs');
const path = require('path');
const { getSessionsDir, getSessionDir, readSessionField } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Argument Parsing
// ============================================================================

const ARG_SPEC = {
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

/** @type {string[]} */
const ACTIVE_STATES = ['PLANNING', 'EXECUTION', 'VERIFICATION'];

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
 * @param {string} sessionId - Session ID
 * @param {string} phase - Session phase
 * @param {number} ageDays - Session age in days
 * @param {Object} mode - Cleanup mode
 * @returns {boolean} True if session should be deleted
 */
function shouldDeleteSession(sessionId, phase, ageDays, mode) {
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
// Clean Sessions
// ============================================================================

/**
 * Clean sessions based on mode
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

    if (shouldDeleteSession(sessionId, metadata.phase, metadata.age_days, mode)) {
      try {
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
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    const helpText = generateHelp(
      'ultrawork-clean.js',
      ARG_SPEC,
      'Clean up ultrawork sessions based on age and status.\n\n' +
      'Modes:\n' +
      '  --older-than N  Delete sessions older than N days in terminal states (default: 7)\n' +
      '  --completed     Delete all sessions in terminal states (COMPLETE, CANCELLED, FAILED)\n' +
      '  --all           Delete ALL sessions including active ones\n\n' +
      'Terminal states: COMPLETE, CANCELLED, FAILED\n' +
      'Active states: PLANNING, EXECUTION, VERIFICATION (preserved by default)'
    );
    console.log(helpText);
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Determine cleanup mode
  const mode = {
    all: args.all || false,
    completed: args.completed || false,
    olderThan: args.olderThan || DEFAULT_DAYS
  };

  // Run cleanup
  const result = cleanSessions(mode);

  // Output result as JSON
  console.log(JSON.stringify(result, null, 2));
}

main();
