#!/usr/bin/env bun
/**
 * loop-state.js - Teamwork loop state management
 * Tracks active loop sessions per terminal/project
 * Usage: loop-state.js --get | --set --project <name> --team <name> --role <name> | --clear
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Constants
// ============================================================================

const TEAMWORK_DIR = path.join(os.homedir(), '.claude', 'teamwork');
const STATE_DIR = path.join(TEAMWORK_DIR, '.loop-state');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get unique terminal identifier
 * Uses CLAUDE_SESSION_ID if available, otherwise falls back to process.pid
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
 * Ensure state directory exists
 * @returns {void}
 */
function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Get current ISO 8601 timestamp
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {boolean} [get]
 * @property {boolean} [set]
 * @property {boolean} [clear]
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [role]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--get': { key: 'get', aliases: ['-g'], flag: true },
  '--set': { key: 'set', aliases: ['-s'], flag: true },
  '--clear': { key: 'clear', aliases: ['-c'], flag: true },
  '--project': { key: 'project', aliases: ['-p'] },
  '--team': { key: 'team', aliases: ['-t'] },
  '--role': { key: 'role', aliases: ['-r'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Operations
// ============================================================================

/**
 * Get loop state
 * @returns {void}
 */
function getLoopState() {
  const stateFile = getStateFile();

  if (fs.existsSync(stateFile)) {
    const content = fs.readFileSync(stateFile, 'utf-8');
    console.log(content);
    process.exit(0);
  } else {
    console.log(JSON.stringify({ active: false }, null, 2));
    process.exit(1);
  }
}

/**
 * Set loop state
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} role - Worker role
 * @returns {void}
 */
function setLoopState(project, team, role) {
  ensureStateDir();

  const stateFile = getStateFile();
  const state = {
    active: true,
    project,
    team,
    role,
    started_at: getTimestamp(),
    terminal_id: getTerminalId(),
  };

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({
    status: 'success',
    message: `Loop started: ${stateFile}`,
    state,
  }, null, 2));
  process.exit(0);
}

/**
 * Clear loop state
 * @returns {void}
 */
function clearLoopState() {
  const stateFile = getStateFile();

  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
    console.log(JSON.stringify({
      status: 'success',
      message: 'Loop stopped',
    }, null, 2));
    process.exit(0);
  } else {
    console.log(JSON.stringify({
      status: 'info',
      message: 'No active loop',
    }, null, 2));
    process.exit(0);
  }
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('loop-state.js', ARG_SPEC, 'Manage teamwork worker loop state per terminal session'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Show help if no operation specified
  if (!args.get && !args.set && !args.clear) {
    console.log(generateHelp('loop-state.js', ARG_SPEC, 'Manage teamwork worker loop state per terminal session'));
    process.exit(1);
  }

  // Execute operation
  if (args.get) {
    getLoopState();
  } else if (args.set) {
    // Validate required parameters
    if (!args.project || !args.team || !args.role) {
      console.error('Error: --set requires --project, --team, and --role');
      process.exit(1);
    }
    setLoopState(args.project, args.team, args.role);
  } else if (args.clear) {
    clearLoopState();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  getTerminalId,
  getStateFile,
  ensureStateDir,
};
