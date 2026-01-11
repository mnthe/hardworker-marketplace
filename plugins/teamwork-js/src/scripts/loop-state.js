#!/usr/bin/env node
/**
 * loop-state.js - Teamwork loop state management
 * Tracks active loop sessions per terminal/project
 * Usage: loop-state.js --get | --set --project <name> --team <name> --role <name> | --clear
 * JavaScript port of loop-state.sh
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

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
 * @property {'get'|'set'|'clear'|null} operation
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [role]
 * @property {boolean} help
 */

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {CliArgs} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {CliArgs} */
  const args = {
    operation: null,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--get':
        args.operation = 'get';
        break;
      case '--set':
        args.operation = 'set';
        break;
      case '--clear':
        args.operation = 'clear';
        break;
      case '--project':
        args.project = argv[++i];
        break;
      case '--team':
        args.team = argv[++i];
        break;
      case '--role':
        args.role = argv[++i];
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
    }
  }

  return args;
}

/**
 * Show help message
 * @returns {void}
 */
function showHelp() {
  console.log('Usage: loop-state.js <operation> [options]');
  console.log('');
  console.log('Operations:');
  console.log('  --get                        Get current loop state (returns JSON)');
  console.log('  --set                        Set loop state (requires --project, --team, --role)');
  console.log('  --clear                      Clear loop state');
  console.log('');
  console.log('Options (for --set):');
  console.log('  --project <name>             Project name');
  console.log('  --team <name>                Team name');
  console.log('  --role <name>                Worker role');
  console.log('');
  console.log('Examples:');
  console.log('  loop-state.js --get');
  console.log('  loop-state.js --set --project myapp --team alpha --role backend');
  console.log('  loop-state.js --clear');
}

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
  const args = parseArgs(process.argv);

  // Show help
  if (args.help || !args.operation) {
    showHelp();
    process.exit(args.operation ? 0 : 1);
  }

  // Execute operation
  switch (args.operation) {
    case 'get':
      getLoopState();
      break;

    case 'set':
      // Validate required parameters
      if (!args.project || !args.team || !args.role) {
        console.error('Error: --set requires --project, --team, and --role');
        process.exit(1);
      }
      setLoopState(args.project, args.team, args.role);
      break;

    case 'clear':
      clearLoopState();
      break;

    default:
      console.error(`Error: Unknown operation '${args.operation}'`);
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  getTerminalId,
  getStateFile,
  ensureStateDir,
};
