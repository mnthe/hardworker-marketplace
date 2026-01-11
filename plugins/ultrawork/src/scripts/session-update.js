#!/usr/bin/env bun
/**
 * session-update.js - Update session
 * Usage: session-update.js --session <ID> [--phase PHASE] [--exploration-stage STAGE] [--iteration N]
 */

const { updateSession, resolveSessionId, readSession } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Phase Validation
// ============================================================================

/** @type {import('../lib/types.js').Phase[]} */
const VALID_PHASES = ['PLANNING', 'EXECUTION', 'VERIFICATION', 'COMPLETE', 'CANCELLED', 'FAILED', 'unknown'];

const ARG_SPEC = {
  '--session': { key: 'sessionId', alias: '-s', required: true },
  '--phase': { key: 'phase', alias: '-p' },
  '--plan-approved': { key: 'planApproved', alias: '-P', flag: true },
  '--exploration-stage': { key: 'explorationStage', alias: '-e' },
  '--iteration': { key: 'iteration', alias: '-i' },
  '--quiet': { key: 'quiet', alias: '-q', flag: true },
  '--help': { key: 'help', alias: '-h', flag: true }
};

/**
 * Normalize phase value to canonical form
 * @param {string} phase - Raw phase input
 * @returns {import('../lib/types.js').Phase} Normalized phase
 * @throws {Error} If phase is invalid
 */
function normalizePhase(phase) {
  const upper = phase.toUpperCase();

  // Map variations to canonical forms
  const phaseMap = {
    'COMPLETED': 'COMPLETE',
    'COMPLETE': 'COMPLETE',
    'CANCELED': 'CANCELLED',
    'CANCELLED': 'CANCELLED',
    'PLANNING': 'PLANNING',
    'EXECUTION': 'EXECUTION',
    'VERIFICATION': 'VERIFICATION',
    'FAILED': 'FAILED',
    'UNKNOWN': 'unknown'
  };

  const normalized = phaseMap[upper];

  if (!normalized || !VALID_PHASES.includes(normalized)) {
    throw new Error(
      `Invalid phase: ${phase}. Valid phases: ${VALID_PHASES.filter(p => p !== 'unknown').join(', ')}`
    );
  }

  return normalized;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Phase} Phase
 * @typedef {import('../lib/types.js').ExplorationStage} ExplorationStage
 */

/**
 * @typedef {Object} UpdateArgs
 * @property {string} [sessionId]
 * @property {Phase} [phase]
 * @property {boolean} [planApproved]
 * @property {ExplorationStage} [explorationStage]
 * @property {number} [iteration]
 * @property {boolean} [quiet]
 * @property {boolean} [help]
 */

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('session-update.js', ARG_SPEC, 'Update session phase, plan approval, exploration stage, or iteration number'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  try {
    // Validate session exists
    resolveSessionId(args.sessionId);

    // Normalize and validate phase if provided
    if (args.phase) {
      args.phase = normalizePhase(args.phase);
    }

    // Update session with file locking
    await updateSession(args.sessionId, (session) => {
      // Update phase if provided
      if (args.phase) {
        session.phase = args.phase;
      }

      // Update plan approval if provided
      if (args.planApproved) {
        session.plan.approved_at = new Date().toISOString();
      }

      // Update exploration stage if provided
      if (args.explorationStage) {
        session.exploration_stage = args.explorationStage;
      }

      // Update iteration if provided
      if (args.iteration !== undefined) {
        session.iteration = args.iteration;
      }

      return session;
    });

    // Read and output updated session
    const updatedSession = readSession(args.sessionId);

    if (args.quiet) {
      // Compact single-line output
      console.log(
        `Session updated: phase=${updatedSession.phase} iteration=${updatedSession.iteration} updated_at=${updatedSession.updated_at}`
      );
    } else {
      // Default full JSON output
      console.log('OK: Session updated');
      console.log(JSON.stringify(updatedSession, null, 2));
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
