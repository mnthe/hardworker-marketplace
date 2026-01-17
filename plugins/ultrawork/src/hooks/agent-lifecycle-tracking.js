#!/usr/bin/env bun

/**
 * Agent Lifecycle Tracking Hook (PreToolUse)
 * Tracks when agents are spawned via Task tool during ultrawork sessions
 * v1.0: JavaScript version with JSDoc types
 */

const fs = require('fs');
const {
  getSessionFile,
  updateSession,
  getClaudeSessionId,
} = require('../lib/session-utils.js');
const {
  readStdin,
  createPreToolUsePermission,
  runHook
} = require('../lib/hook-utils.js');

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').Phase} Phase
 * @typedef {import('../lib/types.js').EvidenceEntry} EvidenceEntry
 */

// ============================================================================
// Hook Types
// ============================================================================

/**
 * @typedef {Object} ToolInput
 * @property {string} [task_id]
 * @property {string} [description]
 */

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {string} [tool_name]
 * @property {ToolInput} [tool_input]
 */

/**
 * Output hook response (always allow)
 * @returns {Object}
 */
function outputAllow() {
  return createPreToolUsePermission('allow');
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main() {
  // Read stdin JSON
  const input = await readStdin();
  /** @type {HookInput} */
  const hookInput = JSON.parse(input);

  // Parse tool name
  const toolName = hookInput.tool_name || '';

  // Only process Task tool usage - exit silently for other tools
  if (toolName !== 'Task') {
    console.log(JSON.stringify(outputAllow()));
    process.exit(0);
    return;
  }

  // Get session ID from input
  const sessionId = hookInput.session_id;

  // No active ultrawork session - allow without tracking
  if (!sessionId) {
    console.log(JSON.stringify(outputAllow()));
    process.exit(0);
    return;
  }

  // Check if session file exists
  const sessionFile = getSessionFile(sessionId);
  if (!fs.existsSync(sessionFile)) {
    console.log(JSON.stringify(outputAllow()));
    process.exit(0);
    return;
  }

  // Read session phase
  const content = fs.readFileSync(sessionFile, 'utf-8');
  /** @type {Session} */
  const session = JSON.parse(content);
  const phase = session.phase || 'unknown';

  // Track during active phases (PLANNING, EXECUTION, VERIFICATION)
  /** @type {Phase[]} */
  const activePhases = ['PLANNING', 'EXECUTION', 'VERIFICATION'];
  if (!activePhases.includes(phase)) {
    console.log(JSON.stringify(outputAllow()));
    process.exit(0);
    return;
  }

  // Parse Task tool parameters
  const taskId = hookInput.tool_input?.task_id || '';
  const description = hookInput.tool_input?.description || '';

  // If no task_id, this isn't a worker spawn (might be TaskCreate, TaskUpdate, etc.)
  if (!taskId) {
    console.log(JSON.stringify(outputAllow()));
    process.exit(0);
    return;
  }

  // Log agent spawn attempt
  const timestamp = new Date().toISOString();

  // Update session with agent spawn tracking (with locking)
  try {
    await updateSession(sessionId, (s) => {
      /** @type {EvidenceEntry} */
      const evidence = {
        type: 'agent_completed',
        timestamp,
        agent_id: 'spawning',
        task_id: taskId,
      };

      // Add custom fields for spawn tracking
      const spawnEvidence = {
        ...evidence,
        type: 'agent_spawn_initiated',
        description,
      };

      return {
        ...s,
        evidence_log: [...s.evidence_log, spawnEvidence],
      };
    });
  } catch {
    // Silently ignore update errors
  }

  // Allow the Task tool to proceed
  console.log(JSON.stringify(outputAllow()));
  process.exit(0);
}

// Entry point
runHook(main, outputAllow);
