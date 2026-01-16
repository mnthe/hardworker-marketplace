#!/usr/bin/env bun

/**
 * Teamwork loop detector hook
 * Detects __TEAMWORK_CONTINUE__ marker in Stop event and triggers next worker iteration
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// ============================================================================
// Constants
// ============================================================================

const TEAMWORK_DIR = path.join(os.homedir(), '.claude', 'teamwork');
const STATE_DIR = path.join(TEAMWORK_DIR, '.loop-state');

// ============================================================================
// Types
// ============================================================================

/**
 * @typedef {Object} HookInput
 * @property {string} [transcript]
 * @property {string} [output]
 * @property {string} [session_id]
 */

/**
 * @typedef {Object} LoopState
 * @property {boolean} active
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [role]
 * @property {string} [started_at]
 * @property {string} [terminal_id]
 * @property {string} [fresh_start_at]
 * @property {number} [iteration_since_fresh_start]
 */

/**
 * @typedef {Object} HookOutput
 * @property {'continue' | 'restart_fresh' | 'allow'} [decision]
 * @property {string} [command]
 * @property {Object} [context]
 * @property {string} [systemMessage]
 */

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get unique terminal identifier
 * @returns {string} Terminal ID
 */
function getTerminalId() {
  return process.env.CLAUDE_SESSION_ID || String(process.pid);
}

/**
 * Get state file path for current terminal
 * @returns {string} State file path
 */
function getStateFile() {
  const terminalId = getTerminalId();
  return path.join(STATE_DIR, `${terminalId}.json`);
}

/**
 * Get loop state for current terminal
 * @returns {LoopState}
 */
function getLoopState() {
  const stateFile = getStateFile();

  if (!fs.existsSync(stateFile)) {
    return { active: false };
  }

  try {
    const content = fs.readFileSync(stateFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { active: false };
  }
}

/**
 * Save loop state for current terminal
 * @param {LoopState} state - Loop state to save
 * @returns {void}
 */
function saveLoopState(state) {
  const stateFile = getStateFile();

  try {
    // Ensure state directory exists
    const stateDir = path.dirname(stateFile);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    // Write state to file
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignore errors during save
  }
}

/**
 * Clear loop state for current terminal
 * @returns {void}
 */
function clearLoopState() {
  const stateFile = getStateFile();

  if (fs.existsSync(stateFile)) {
    try {
      fs.unlinkSync(stateFile);
    } catch {
      // Ignore errors during cleanup
    }
  }
}

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
 * Output hook response and exit
 * @param {HookOutput} output
 * @returns {void}
 */
function outputAndExit(output) {
  // Wrap output in v2.1.9 hookSpecificOutput format
  const hookOutput = {
    hookSpecificOutput: {
      hookEventName: "Stop",
      ...output
    }
  };

  // Convert systemMessage to additionalContext for v2.1.9
  if (hookOutput.hookSpecificOutput.systemMessage) {
    hookOutput.hookSpecificOutput.additionalContext = hookOutput.hookSpecificOutput.systemMessage;
    delete hookOutput.hookSpecificOutput.systemMessage;
  }

  console.log(JSON.stringify(hookOutput));
  process.exit(0);
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main() {
  try {
    // Read hook input from stdin
    const input = await readStdin();
    /** @type {HookInput} */
    const hookInput = JSON.parse(input);

    // Check if loop is active for this terminal
    const state = getLoopState();

    if (!state.active) {
      // No active loop - allow normal exit
      outputAndExit({});
      return;
    }

    // Extract transcript from hook input
    // Try transcript field first, then output, then use raw input
    const transcript = hookInput.transcript || hookInput.output || input;

    // Check for fresh-start marker
    if (transcript.includes('__TEAMWORK_FRESH_START__')) {
      // Fresh start requested - update loop state and trigger restart
      state.fresh_start_at = new Date().toISOString();
      state.iteration_since_fresh_start = 0;

      // Save updated state
      saveLoopState(state);

      // Get loop context from state file
      const project = state.project || '';
      const team = state.team || '';
      const role = state.role || '';

      // Build command
      let cmd = '/teamwork-worker --loop';
      if (project && project !== 'null') {
        cmd += ` --project ${project}`;
      }
      if (team && team !== 'null') {
        cmd += ` --team ${team}`;
      }
      if (role && role !== 'null') {
        cmd += ` --role ${role}`;
      }

      // Output JSON to trigger fresh restart
      outputAndExit({
        decision: 'restart_fresh',
        command: cmd,
        context: {
          project,
          team,
          role,
          fresh_start_at: state.fresh_start_at,
        },
        systemMessage: 'Teamwork loop: fresh start triggered',
      });
      return;
    }

    // Check for continue marker
    if (!transcript.includes('__TEAMWORK_CONTINUE__')) {
      // No continue marker = loop done, clean up state
      clearLoopState();
      outputAndExit({});
      return;
    }

    // Get loop context from state file
    const project = state.project || '';
    const team = state.team || '';
    const role = state.role || '';

    // Build command
    let cmd = '/teamwork-worker --loop';
    if (project && project !== 'null') {
      cmd += ` --project ${project}`;
    }
    if (team && team !== 'null') {
      cmd += ` --team ${team}`;
    }
    if (role && role !== 'null') {
      cmd += ` --role ${role}`;
    }

    // Output JSON to trigger next iteration
    outputAndExit({
      decision: 'continue',
      command: cmd,
      context: {
        project,
        team,
        role,
      },
      systemMessage: 'Teamwork loop: continuing to next task',
    });

  } catch (err) {
    // On error, output minimal valid JSON and exit 0
    // Hooks should never fail the tool execution
    outputAndExit({});
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Handle stdin
if (process.stdin.isTTY) {
  // No stdin available, output minimal response
  console.log('{}');
  process.exit(0);
} else {
  // Read stdin and process
  process.stdin.setEncoding('utf8');
  main().catch(() => {
    // On error, output minimal valid JSON and exit 0
    console.log('{}');
    process.exit(0);
  });
}
