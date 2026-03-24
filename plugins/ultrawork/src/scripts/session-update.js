#!/usr/bin/env bun
/**
 * session-update.js - Update session
 * Usage: session-update.js --session <ID> [--phase PHASE] [--exploration-stage STAGE] [--iteration N]
 */

const fs = require('fs');
const path = require('path');
const { updateSession, resolveSessionId, readSession, validatePhaseTransition, getSessionDir } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

/**
 * Validation error thrown inside updateSession callback.
 * Carries an exit code so the caller can process.exit() after the lock is released.
 */
class GateError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'GateError';
  }
}

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

    // ========================================================================
    // Pre-lock validation (pure argument checks, no file I/O)
    // ========================================================================

    // Reject combining gate flags with phase transitions (two-step required)
    if ((args.verifierPassed || args.documenterCompleted) && args.phase) {
      const flag = args.verifierPassed ? '--verifier-passed' : '--documenter-completed';
      console.error(`Error: ${flag} cannot be combined with --phase. Set the flag first, then transition in a separate call.`);
      process.exit(1);
    }

    // Normalize and validate phase if provided
    if (args.phase) {
      args.phase = normalizePhase(args.phase);
    }

    // ========================================================================
    // Update session with file locking (all validation inside lock)
    // ========================================================================
    await updateSession(args.sessionId, (session) => {
      // --verifier-passed validation: only allowed during VERIFICATION phase
      if (args.verifierPassed) {
        if (session.phase !== 'VERIFICATION') {
          throw new GateError(`--verifier-passed can only be set during VERIFICATION phase (current: ${session.phase}).`);
        }

        // Prerequisite: all non-verify tasks must be resolved
        const sessionDir = getSessionDir(args.sessionId);
        const tasksDir = path.join(sessionDir, 'tasks');
        if (fs.existsSync(tasksDir)) {
          for (const f of fs.readdirSync(tasksDir)) {
            if (!f.endsWith('.json')) continue;
            const taskId = f.replace('.json', '');
            if (taskId === 'verify') continue;
            try {
              const task = JSON.parse(fs.readFileSync(path.join(tasksDir, f), 'utf-8'));
              if (task.status !== 'resolved') {
                throw new GateError(`--verifier-passed requires all non-verify tasks to be resolved. Task "${taskId}" has status "${task.status}".`);
              }
            } catch (e) {
              if (e instanceof GateError) throw e;
              // Malformed JSON: treat as unresolved (fail-closed)
              throw new GateError(`--verifier-passed requires all non-verify tasks to be resolved. Task "${taskId}" has malformed JSON (treated as unresolved).`);
            }
          }
        }
      }

      // --documenter-completed validation: only allowed during DOCUMENTATION phase
      if (args.documenterCompleted) {
        if (session.phase !== 'DOCUMENTATION') {
          throw new GateError(`--documenter-completed can only be set during DOCUMENTATION phase (current: ${session.phase}).`);
        }

        // Prerequisite: verifier_passed must be set
        if (!session.verifier_passed) {
          throw new GateError('--documenter-completed requires verifier_passed to be set first.');
        }
      }

      // Phase transition validation
      if (args.phase) {
        const currentPhase = session.phase;

        // Skip validation if phase isn't changing
        if (currentPhase !== args.phase) {
          const result = validatePhaseTransition(currentPhase, args.phase);

          if (!result.allowed) {
            throw new GateError(result.reason);
          }

          // Gate: VERIFICATION → DOCUMENTATION requires verifier_passed already set
          if (args.phase === 'DOCUMENTATION' && currentPhase === 'VERIFICATION') {
            if (!session.verifier_passed) {
              throw new GateError('VERIFICATION → DOCUMENTATION requires verifier_passed. Set --verifier-passed first in a separate call.');
            }
          }

          // Gate: COMPLETE requires verifier_passed + documenter_completed + sufficient evidence
          if (args.phase === 'COMPLETE') {
            if (!session.verifier_passed) {
              throw new GateError('Cannot transition to COMPLETE without verifier approval.\nRun the Verifier agent first: session-update.js --phase VERIFICATION');
            }

            // Require documenter_completed already set in session
            if (currentPhase === 'DOCUMENTATION' && !session.documenter_completed) {
              throw new GateError('DOCUMENTATION → COMPLETE requires documenter_completed. Set --documenter-completed first in a separate call.');
            }

            // Check evidence from log.jsonl
            const sessionDir = getSessionDir(args.sessionId);
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
              throw new GateError(`Insufficient evidence. ${evidenceCount} evidence entries for ${resolvedTasks} resolved tasks.`);
            }
          }
        }
      }

      // ====================================================================
      // Apply changes (validation passed)
      // ====================================================================

      // Update phase if provided
      if (args.phase) {
        session.phase = args.phase;

        // Reset verification state on EXECUTION transition (Ralph loop)
        if (args.phase === 'EXECUTION') {
          session.verifier_passed = false;
          session.documenter_completed = false;
        }
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

    // Clean up Codex result file on EXECUTION transition (Ralph loop)
    if (args.phase === 'EXECUTION') {
      const codexResultPath = `/tmp/codex-${args.sessionId}.json`;
      try { fs.unlinkSync(codexResultPath); } catch { /* file may not exist */ }
      const codexDocResultPath = `/tmp/codex-doc-${args.sessionId}.json`;
      try { fs.unlinkSync(codexDocResultPath); } catch { /* file may not exist */ }
    }

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
