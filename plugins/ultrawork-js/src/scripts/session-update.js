#!/usr/bin/env node
/**
 * session-update.js - Update session
 * Usage: session-update.js --session <ID> [--phase PHASE] [--exploration-stage STAGE] [--iteration N]
 * JavaScript port of session-update.sh
 */

const { updateSession, resolveSessionId, readSession } = require('../lib/session-utils.js');

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
 */

/**
 * Parse command-line arguments
 * @param {string[]} args - Process argv array
 * @returns {UpdateArgs} Parsed arguments
 */
function parseArgs(args) {
  /** @type {UpdateArgs} */
  const result = {};

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--session':
        result.sessionId = args[++i];
        break;
      case '--phase':
        result.phase = /** @type {Phase} */ (args[++i]);
        break;
      case '--plan-approved':
        result.planApproved = true;
        break;
      case '--exploration-stage':
        result.explorationStage = /** @type {ExplorationStage} */ (args[++i]);
        break;
      case '--iteration':
        result.iteration = parseInt(args[++i], 10);
        break;
      case '-h':
      case '--help':
        console.log(
          'Usage: session-update.js --session <ID> [--phase ...] [--plan-approved] [--exploration-stage STAGE] [--iteration N]'
        );
        console.log('');
        console.log('Exploration stages: not_started, overview, analyzing, targeted, complete');
        process.exit(0);
        break;
    }
  }

  return result;
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  const args = parseArgs(process.argv);

  if (!args.sessionId) {
    console.error('Error: --session is required');
    process.exit(1);
  }

  try {
    // Validate session exists
    resolveSessionId(args.sessionId);

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
    console.log('OK: Session updated');
    console.log(JSON.stringify(updatedSession, null, 2));
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
