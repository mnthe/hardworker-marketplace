#!/usr/bin/env bun
/**
 * swarm-status.js - Query swarm status including tmux session and worker state
 * Displays current swarm status with worker alive states and task assignments
 *
 * Usage: swarm-status.js --project <name> --team <name> [--format json|table]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} project
 * @property {string} team
 * @property {'json'|'table'} [format]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--format': { key: 'format', aliases: ['-f'], default: 'json' },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Swarm State Management
// ============================================================================

/**
 * Get swarm directory path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Swarm directory path
 */
function getSwarmDir(project, team) {
  return path.join(getProjectDir(project, team), 'swarm');
}

/**
 * Get swarm.json file path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Swarm file path
 */
function getSwarmFile(project, team) {
  return path.join(getSwarmDir(project, team), 'swarm.json');
}

/**
 * Get workers directory path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Workers directory path
 */
function getWorkersDir(project, team) {
  return path.join(getSwarmDir(project, team), 'workers');
}

/**
 * Read swarm.json file
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Object|null} Swarm data or null if not found
 */
function readSwarmFile(project, team) {
  const swarmFile = getSwarmFile(project, team);

  if (!fs.existsSync(swarmFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(swarmFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Read worker state file
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @returns {Object|null} Worker data or null if not found
 */
function readWorkerFile(project, team, workerId) {
  const workerFile = path.join(getWorkersDir(project, team), `${workerId}.json`);

  if (!fs.existsSync(workerFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(workerFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ============================================================================
// tmux Control
// ============================================================================

/**
 * Check if tmux session exists
 * @param {string} sessionName - tmux session name
 * @returns {boolean} True if session exists
 */
function tmuxSessionExists(sessionName) {
  try {
    execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`, {
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get tmux pane states with extended info (command, alive status)
 * @param {string} sessionName - tmux session name
 * @returns {Object.<number, {alive: boolean, command: string}>} Map of pane index to state info
 */
function getTmuxPaneStates(sessionName) {
  try {
    const output = execSync(`tmux list-panes -t "${sessionName}" -F "#{pane_index}:#{pane_dead}:#{pane_current_command}"`, {
      encoding: 'utf-8'
    });

    const paneStates = {};
    const lines = output.trim().split('\n');

    for (const line of lines) {
      const parts = line.split(':');
      const paneIndex = parseInt(parts[0], 10);
      const isDead = parts[1] === '1';
      const command = parts.slice(2).join(':') || 'unknown'; // Handle commands with colons
      paneStates[paneIndex] = {
        alive: !isDead,
        command: command
      };
    }

    return paneStates;
  } catch {
    return {};
  }
}

// ============================================================================
// Status Collection
// ============================================================================

/**
 * Scan workers directory for all worker state files
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string[]} Array of worker IDs found in directory
 */
function scanWorkersDirectory(project, team) {
  const workersDir = getWorkersDir(project, team);

  if (!fs.existsSync(workersDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(workersDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort((a, b) => {
        // Sort w1, w2, w3... numerically
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
  } catch {
    return [];
  }
}

/**
 * Collect swarm status
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Object} Swarm status object
 */
function collectSwarmStatus(project, team) {
  const projectDir = getProjectDir(project, team);

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project not found: ${project}/${team}`);
  }

  // Read swarm.json
  const swarmData = readSwarmFile(project, team);

  if (!swarmData) {
    return {
      status: 'not_initialized',
      session: null,
      workers: []
    };
  }

  const sessionName = swarmData.session;

  // Check tmux session existence
  const sessionExists = tmuxSessionExists(sessionName);

  // Get pane states if session exists
  const paneStates = sessionExists ? getTmuxPaneStates(sessionName) : {};

  // Scan workers directory for all workers (more reliable than swarm.json)
  // This handles cases where swarm.json was overwritten by multiple spawn calls
  const workerIds = scanWorkersDirectory(project, team);

  // Read worker state files
  const workers = [];
  for (const workerId of workerIds) {
    const workerData = readWorkerFile(project, team, workerId);

    if (!workerData) {
      workers.push({
        id: workerId,
        role: 'unknown',
        pane: null,
        alive: false,
        current_task: null,
        status: 'not_found'
      });
      continue;
    }

    const paneIndex = workerData.pane;
    const paneInfo = paneStates[paneIndex] || { alive: false, command: 'unknown' };

    workers.push({
      id: workerId,
      role: workerData.role,
      pane: paneIndex,
      alive: paneInfo.alive,
      command: paneInfo.command,
      current_task: workerData.current_task || null,
      status: workerData.status || 'unknown'
    });
  }

  return {
    status: sessionExists ? 'running' : 'stopped',
    session: sessionName,
    workers
  };
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format status as JSON
 * @param {Object} status - Swarm status object
 * @returns {string} JSON output
 */
function formatJSON(status) {
  return JSON.stringify(status, null, 2);
}

/**
 * Format status as table
 * @param {Object} status - Swarm status object
 * @returns {string} Table output
 */
function formatTable(status) {
  const lines = [];

  lines.push('═'.repeat(70));
  lines.push(' SWARM STATUS');
  lines.push('═'.repeat(70));
  lines.push('');
  lines.push(` Session: ${status.session || 'N/A'}`);
  lines.push(` Status:  ${status.status}`);
  lines.push('');

  if (status.workers.length === 0) {
    lines.push(' No workers found.');
    lines.push('');
  } else {
    lines.push('─'.repeat(85));
    lines.push(' WORKERS');
    lines.push('─'.repeat(85));
    lines.push('');
    lines.push('| ID  | Role       | Pane | Alive | Command     | Task | Status      |');
    lines.push('|-----|------------|------|-------|-------------|------|-------------|');

    for (const worker of status.workers) {
      const aliveIcon = worker.alive ? '✓' : '✗';
      const taskDisplay = worker.current_task || '-';
      const paneDisplay = worker.pane !== null ? worker.pane.toString() : '-';
      const cmdDisplay = (worker.command || '-').substring(0, 11);

      lines.push(
        `| ${worker.id.padEnd(3)} ` +
        `| ${worker.role.padEnd(10).substring(0, 10)} ` +
        `| ${paneDisplay.padEnd(4)} ` +
        `| ${aliveIcon.padEnd(5)} ` +
        `| ${cmdDisplay.padEnd(11)} ` +
        `| ${taskDisplay.toString().padEnd(4)} ` +
        `| ${worker.status.padEnd(11).substring(0, 11)} |`
      );
    }

    lines.push('');
  }

  lines.push('═'.repeat(70));

  return lines.join('\n');
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Display swarm status
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function displayStatus(args) {
  const status = collectSwarmStatus(args.project, args.team);

  if (args.format === 'json') {
    console.log(formatJSON(status));
  } else {
    console.log(formatTable(status));
  }
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  try {
    // Check for help flag first
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(generateHelp(
        'swarm-status.js',
        ARG_SPEC,
        'Query swarm status including tmux session and worker state'
      ));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

    // Validate format
    if (args.format && args.format !== 'json' && args.format !== 'table') {
      throw new Error(`Invalid format: ${args.format}. Must be 'json' or 'table'`);
    }

    // Display status
    displayStatus(args);

  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Unknown error occurred');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  collectSwarmStatus,
  tmuxSessionExists,
  getTmuxPaneStates
};
