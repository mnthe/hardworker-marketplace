#!/usr/bin/env bun

/**
 * Teamwork loop detector hook
 * Detects __TEAMWORK_CONTINUE__ marker in Stop event and triggers next worker iteration
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { readStdin, outputAndExit, hasStdin, extractTextContent } = require('../lib/hook-utils.js');

// ============================================================================
// Constants
// ============================================================================

const TEAMWORK_DIR = process.env.TEAMWORK_TEST_BASE_DIR || path.join(os.homedir(), '.claude', 'teamwork');
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
 * Stop hook output format (top-level properties, no hookSpecificOutput)
 * @typedef {Object} HookOutput
 * @property {'approve' | 'block'} [decision] - approve: allow stop, block: continue working
 * @property {string} [reason] - Explanation for the decision
 * @property {string} [systemMessage] - Additional context for Claude
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

// ============================================================================
// Project/Swarm State Checks
// ============================================================================

/**
 * Check if project is complete
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {boolean} True if project phase is COMPLETE
 */
function isProjectComplete(project, team) {
  if (!project || !team) {
    return false;
  }

  const projectFile = path.join(TEAMWORK_DIR, project, team, 'project.json');

  if (!fs.existsSync(projectFile)) {
    return false;
  }

  try {
    const content = fs.readFileSync(projectFile, 'utf-8');
    const projectData = JSON.parse(content);
    return projectData.phase === 'COMPLETE';
  } catch {
    return false;
  }
}

/**
 * Check if swarm shutdown was requested
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {boolean} True if shutdown requested
 */
function isSwarmShutdownRequested(project, team) {
  if (!project || !team) {
    return false;
  }

  const swarmFile = path.join(TEAMWORK_DIR, project, team, 'swarm', 'swarm.json');

  if (!fs.existsSync(swarmFile)) {
    return false;
  }

  try {
    const content = fs.readFileSync(swarmFile, 'utf-8');
    const swarmData = JSON.parse(content);
    return swarmData.shutdown_requested === true || swarmData.status === 'stopped';
  } catch {
    return false;
  }
}

/**
 * Check if all tasks are complete (no open or in_progress)
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {boolean} True if all tasks complete
 */
function areAllTasksComplete(project, team) {
  if (!project || !team) {
    return false;
  }

  const tasksDir = path.join(TEAMWORK_DIR, project, team, 'tasks');

  if (!fs.existsSync(tasksDir)) {
    return true; // No tasks = complete
  }

  try {
    const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
      return true; // No tasks = complete
    }

    for (const file of files) {
      const taskPath = path.join(tasksDir, file);
      const content = fs.readFileSync(taskPath, 'utf-8');
      const task = JSON.parse(content);

      if (task.status === 'open' || task.status === 'in_progress') {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if worker loop should stop
 * @param {LoopState} state - Current loop state
 * @returns {{shouldStop: boolean, reason: string}} Stop decision and reason
 */
function shouldStopLoop(state) {
  const project = state.project;
  const team = state.team;

  // Check 1: Project phase is COMPLETE
  if (isProjectComplete(project, team)) {
    return { shouldStop: true, reason: 'Project phase is COMPLETE' };
  }

  // Check 2: Swarm shutdown requested
  if (isSwarmShutdownRequested(project, team)) {
    return { shouldStop: true, reason: 'Swarm shutdown requested' };
  }

  // Check 3: All tasks are resolved (no open or in_progress)
  if (areAllTasksComplete(project, team)) {
    return { shouldStop: true, reason: 'All tasks complete' };
  }

  return { shouldStop: false, reason: '' };
}

// ============================================================================
// Main Hook Logic
// ============================================================================

/**
 * Main hook execution logic
 * @returns {Promise<void>}
 */
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
    const transcript = extractTextContent(hookInput, input);

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

      // Output JSON to trigger fresh restart (block exit, feed command as next prompt)
      outputAndExit({
        decision: 'block',
        reason: cmd,
        systemMessage: `🔄 Teamwork fresh start | Project: ${project} | Role: ${role}`,
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

    // Check if loop should stop (project complete, shutdown requested, or all tasks done)
    const stopCheck = shouldStopLoop(state);
    if (stopCheck.shouldStop) {
      clearLoopState();
      outputAndExit({
        decision: 'approve',
        reason: `Loop stopped: ${stopCheck.reason}`,
        systemMessage: `✅ Teamwork loop stopped | Reason: ${stopCheck.reason}`,
      });
      return;
    }

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

    // Output JSON to trigger next iteration (block exit, feed command as next prompt)
    outputAndExit({
      decision: 'block',
      reason: cmd,
      systemMessage: `🔄 Teamwork loop | Project: ${project} | Role: ${role}`,
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

// Check stdin availability before processing
if (!hasStdin()) {
  // No stdin available, output minimal response
  outputAndExit({});
}

// Read stdin and process
process.stdin.setEncoding('utf8');
main().catch(() => {
  // On error, output minimal valid JSON and exit 0
  // Hooks should never fail the tool execution
  outputAndExit({});
});
