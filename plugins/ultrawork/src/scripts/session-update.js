#!/usr/bin/env bun
/**
 * session-update.js - Update session
 * Usage: session-update.js --session <ID> [--phase PHASE] [--exploration-stage STAGE] [--iteration N]
 */

const { updateSession, resolveSessionId, readSession, validatePhaseTransition } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Phase Validation
// ============================================================================

/** @type {import('../lib/types.js').Phase[]} */
const VALID_PHASES = ['PLANNING', 'EXECUTION', 'VERIFICATION', 'DOCUMENTATION', 'COMPLETE', 'CANCELLED', 'FAILED', 'unknown'];

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'], required: true },
  '--phase': { key: 'phase', aliases: ['-p'] },
  '--plan-approved': { key: 'planApproved', aliases: ['-P'], flag: true },
  '--design-doc': { key: 'designDoc', aliases: ['-d'] },
  '--exploration-stage': { key: 'explorationStage', aliases: ['-e'] },
  '--iteration': { key: 'iteration', aliases: ['-i'] },
  '--verifier-passed': { key: 'verifierPassed', aliases: [], flag: true },
  '--documenter-completed': { key: 'documenterCompleted', aliases: [], flag: true },
  '--quiet': { key: 'quiet', aliases: ['-q'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
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
    'DOCUMENTATION': 'DOCUMENTATION',
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
 * @property {string} [designDoc]
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

    // --verifier-passed validation: only allowed during VERIFICATION phase
    if (args.verifierPassed) {
      const currentSession = readSession(args.sessionId);
      if (currentSession.phase !== 'VERIFICATION') {
        console.error(`Error: --verifier-passed can only be set during VERIFICATION phase (current: ${currentSession.phase}).`);
        process.exit(1);
      }
    }

    // --documenter-completed validation: only allowed during DOCUMENTATION phase
    if (args.documenterCompleted) {
      const currentSession = readSession(args.sessionId);
      if (currentSession.phase !== 'DOCUMENTATION') {
        console.error(`Error: --documenter-completed can only be set during DOCUMENTATION phase (current: ${currentSession.phase}).`);
        process.exit(1);
      }
    }

    // Phase transition validation
    if (args.phase) {
      const currentSession = readSession(args.sessionId);
      const currentPhase = currentSession.phase;

      // Skip validation if phase isn't changing
      if (currentPhase !== args.phase) {
        const result = validatePhaseTransition(currentPhase, args.phase);

        if (!result.allowed) {
          console.error(`Error: ${result.reason}`);
          process.exit(1);
        }

        // Additional gate: COMPLETE requires verifier_passed + sufficient evidence
        if (args.phase === 'COMPLETE') {
          if (!currentSession.verifier_passed) {
            console.error('Error: Cannot transition to COMPLETE without verifier approval.');
            console.error('Run the Verifier agent first: session-update.js --phase VERIFICATION');
            process.exit(1);
          }

          // When transitioning from DOCUMENTATION, require documenter_completed
          if (currentPhase === 'DOCUMENTATION' && !currentSession.documenter_completed) {
            console.error('Error: Cannot transition to COMPLETE without documenter completion.');
            console.error('Set --documenter-completed during DOCUMENTATION phase first.');
            process.exit(1);
          }

          // Check evidence from log.jsonl
          const path = require('path');
          const fs = require('fs');
          const sessionDir = require('../lib/session-utils.js').getSessionDir(args.sessionId);
          const evidenceLog = path.join(sessionDir, 'evidence', 'log.jsonl');
          let evidenceCount = 0;
          if (fs.existsSync(evidenceLog)) {
            evidenceCount = fs.readFileSync(evidenceLog, 'utf-8').trim().split('\n').filter(l => l.length > 0).length;
          }

          const tasksDir = path.join(sessionDir, 'tasks');
          let resolvedTasks = 0;
          if (fs.existsSync(tasksDir)) {
            for (const f of fs.readdirSync(tasksDir)) {
              if (!f.endsWith('.json')) continue;
              try {
                const task = JSON.parse(fs.readFileSync(path.join(tasksDir, f), 'utf-8'));
                if (task.status === 'resolved') resolvedTasks++;
              } catch { /* skip invalid */ }
            }
          }

          if (resolvedTasks > 0 && evidenceCount < resolvedTasks) {
            console.error(`Error: Insufficient evidence. ${evidenceCount} evidence entries for ${resolvedTasks} resolved tasks.`);
            process.exit(1);
          }
        }
      }
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

      // Update design doc path if provided
      if (args.designDoc) {
        session.plan.design_doc = args.designDoc;
      }

      // Update exploration stage if provided
      if (args.explorationStage) {
        session.exploration_stage = args.explorationStage;
      }

      // Update iteration if provided
      if (args.iteration !== undefined) {
        session.iteration = args.iteration;
      }

      // Set verifier_passed if provided
      if (args.verifierPassed) {
        session.verifier_passed = true;
      }

      // Set documenter_completed if provided
      if (args.documenterCompleted) {
        session.documenter_completed = true;
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
