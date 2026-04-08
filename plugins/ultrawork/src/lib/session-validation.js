/**
 * Session Phase Validation
 * Phase transition rules and validation logic.
 */

// Import types for JSDoc
/**
 * @typedef {import('./types').Phase} Phase
 */

/** @type {Set<Phase>} */
const TERMINAL_PHASES = new Set(['COMPLETE', 'CANCELLED', 'FAILED']);

/** @type {Set<Phase>} */
const ACTIVE_PHASES = new Set(['PLANNING', 'EXECUTION', 'VERIFICATION', 'DOCUMENTATION']);

/**
 * Validate a phase transition
 * @param {Phase} currentPhase - Current session phase
 * @param {Phase} newPhase - Requested new phase
 * @returns {{ allowed: boolean, reason?: string }}
 */
function validatePhaseTransition(currentPhase, newPhase) {
  // Same phase (no-op) is always allowed
  if (currentPhase === newPhase) {
    return { allowed: true };
  }

  // ANY -> CANCELLED or FAILED is always allowed
  if (newPhase === 'CANCELLED' || newPhase === 'FAILED') {
    return { allowed: true };
  }

  // Terminal phases block transitions to active phases
  if (TERMINAL_PHASES.has(currentPhase) && ACTIVE_PHASES.has(newPhase)) {
    return {
      allowed: false,
      reason: `Phase transition ${currentPhase} \u2192 ${newPhase} blocked: Session is in terminal state. Start a new session.`
    };
  }

  // PLANNING -> EXECUTION (always allowed)
  if (currentPhase === 'PLANNING' && newPhase === 'EXECUTION') {
    return { allowed: true };
  }

  // PLANNING -> VERIFICATION (blocked: must go through EXECUTION first)
  if (currentPhase === 'PLANNING' && newPhase === 'VERIFICATION') {
    return {
      allowed: false,
      reason: `Phase transition ${currentPhase} \u2192 ${newPhase} blocked: EXECUTION phase must come before VERIFICATION.`
    };
  }

  // PLANNING -> COMPLETE (blocked: cannot skip EXECUTION and VERIFICATION)
  if (currentPhase === 'PLANNING' && newPhase === 'COMPLETE') {
    return {
      allowed: false,
      reason: `Phase transition ${currentPhase} \u2192 ${newPhase} blocked: Cannot skip EXECUTION and VERIFICATION phases.`
    };
  }

  // EXECUTION -> VERIFICATION (always allowed)
  if (currentPhase === 'EXECUTION' && newPhase === 'VERIFICATION') {
    return { allowed: true };
  }

  // EXECUTION -> COMPLETE (always blocked: must go through VERIFICATION)
  if (currentPhase === 'EXECUTION' && newPhase === 'COMPLETE') {
    return {
      allowed: false,
      reason: `Phase transition ${currentPhase} \u2192 ${newPhase} blocked: VERIFICATION phase required before completion. Transition to VERIFICATION first.`
    };
  }

  // VERIFICATION -> COMPLETE (blocked: must go through DOCUMENTATION)
  if (currentPhase === 'VERIFICATION' && newPhase === 'COMPLETE') {
    return {
      allowed: false,
      reason: `Phase transition ${currentPhase} \u2192 ${newPhase} blocked: DOCUMENTATION phase required before completion. Transition to DOCUMENTATION first.`
    };
  }

  // VERIFICATION -> DOCUMENTATION (allowed after verification pass)
  if (currentPhase === 'VERIFICATION' && newPhase === 'DOCUMENTATION') {
    return { allowed: true };
  }

  // VERIFICATION -> EXECUTION (Ralph loop)
  if (currentPhase === 'VERIFICATION' && newPhase === 'EXECUTION') {
    return { allowed: true };
  }

  // DOCUMENTATION -> COMPLETE (always allowed)
  if (currentPhase === 'DOCUMENTATION' && newPhase === 'COMPLETE') {
    return { allowed: true };
  }

  // DOCUMENTATION -> EXECUTION (Ralph loop from DOCUMENTATION)
  if (currentPhase === 'DOCUMENTATION' && newPhase === 'EXECUTION') {
    return { allowed: true };
  }

  // Default: block unknown transitions
  return {
    allowed: false,
    reason: `Phase transition ${currentPhase} \u2192 ${newPhase} blocked: Transition not allowed.`
  };
}

module.exports = {
  validatePhaseTransition,
};
