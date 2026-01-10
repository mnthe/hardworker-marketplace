#!/usr/bin/env node

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
 * @typedef {Object} HookOutput
 * @property {Object} hookSpecificOutput
 * @property {string} hookSpecificOutput.hookEventName
 * @property {string} hookSpecificOutput.permissionDecision
 */

// ============================================================================
// Stdin/Stdout Functions
// ============================================================================

/**
 * Read all stdin data
 * @returns {Promise<string>}
 */
async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

/**
 * Output hook response (always allow)
 * @returns {void}
 */
function outputAllow() {
  /** @type {HookOutput} */
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  };
  console.log(JSON.stringify(output));
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main() {
  try {
    // Read stdin JSON
    const input = await readStdin();
    /** @type {HookInput} */
    const hookInput = JSON.parse(input);

    // Parse tool name
    const toolName = hookInput.tool_name || '';

    // Only process Task tool usage - exit silently for other tools
    if (toolName !== 'Task') {
      outputAllow();
      return;
    }

    // Get session ID from input
    const sessionId = hookInput.session_id;

    // No active ultrawork session - allow without tracking
    if (!sessionId) {
      outputAllow();
      return;
    }

    // Check if session file exists
    const sessionFile = getSessionFile(sessionId);
    if (!fs.existsSync(sessionFile)) {
      outputAllow();
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
      outputAllow();
      return;
    }

    // Parse Task tool parameters
    const taskId = hookInput.tool_input?.task_id || '';
    const description = hookInput.tool_input?.description || '';

    // If no task_id, this isn't a worker spawn (might be TaskCreate, TaskUpdate, etc.)
    if (!taskId) {
      outputAllow();
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
    outputAllow();
  } catch {
    // Even on error, output allow and exit 0
    outputAllow();
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Handle stdin
if (process.stdin.isTTY) {
  // No stdin available, output allow response
  outputAllow();
  process.exit(0);
} else {
  // Read stdin and process
  process.stdin.setEncoding('utf8');
  main()
    .then(() => process.exit(0))
    .catch(() => {
      // On error, output allow and exit 0
      outputAllow();
      process.exit(0);
    });
}
