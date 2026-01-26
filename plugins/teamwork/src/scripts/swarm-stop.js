#!/usr/bin/env bun
/**
 * Swarm Stop Script
 * Stops a specific worker or the entire swarm
 *
 * Usage:
 *   swarm-stop.js --project <name> --team <name> --worker <id>
 *   swarm-stop.js --project <name> --team <name> --all
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir } = require('../lib/project-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--worker': { key: 'worker', aliases: ['-w'] },
  '--all': { key: 'all', aliases: ['-a'], flag: true },
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
 * Get swarm.json path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Swarm state file path
 */
function getSwarmFile(project, team) {
  return path.join(getSwarmDir(project, team), 'swarm.json');
}

/**
 * Get worker state file path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @returns {string} Worker state file path
 */
function getWorkerFile(project, team, workerId) {
  return path.join(getSwarmDir(project, team), 'workers', `${workerId}.json`);
}

/**
 * Read swarm state
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Object|null} Swarm state or null if not exists
 */
function readSwarmState(project, team) {
  const swarmFile = getSwarmFile(project, team);

  if (!fs.existsSync(swarmFile)) {
    return null;
  }

  const content = fs.readFileSync(swarmFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write swarm state
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {Object} state - Swarm state
 */
function writeSwarmState(project, team, state) {
  const swarmFile = getSwarmFile(project, team);
  const swarmDir = getSwarmDir(project, team);

  // Ensure swarm directory exists
  if (!fs.existsSync(swarmDir)) {
    fs.mkdirSync(swarmDir, { recursive: true });
  }

  fs.writeFileSync(swarmFile, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Read worker state
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @returns {Object|null} Worker state or null if not exists
 */
function readWorkerState(project, team, workerId) {
  const workerFile = getWorkerFile(project, team, workerId);

  if (!fs.existsSync(workerFile)) {
    return null;
  }

  const content = fs.readFileSync(workerFile, 'utf-8');
  return JSON.parse(content);
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
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop a specific worker pane
 * @param {string} sessionName - tmux session name
 * @param {number} paneIndex - Pane index
 */
function stopWorkerPane(sessionName, paneIndex) {
  const target = `${sessionName}:main.${paneIndex}`;

  try {
    // Send Ctrl+C to stop any running process
    execSync(`tmux send-keys -t ${target} C-c`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    // Wait a moment for process to terminate
    execSync('sleep 0.5', { stdio: 'pipe' });

    // Kill the pane
    execSync(`tmux kill-pane -t ${target}`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  } catch (error) {
    // Pane might already be dead, that's okay
    console.error(`Warning: Failed to stop pane ${target}: ${error.message}`);
  }
}

/**
 * Stop entire tmux session
 * @param {string} sessionName - tmux session name
 */
function stopTmuxSession(sessionName) {
  try {
    execSync(`tmux kill-session -t ${sessionName}`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  } catch (error) {
    throw new Error(`Failed to stop tmux session: ${error.message}`);
  }
}

// ============================================================================
// Worker Stop Logic
// ============================================================================

/**
 * Stop a specific worker
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @returns {Object} Result object
 */
function stopWorker(project, team, workerId) {
  const swarmState = readSwarmState(project, team);

  if (!swarmState) {
    throw new Error('Swarm not found');
  }

  const workerState = readWorkerState(project, team, workerId);

  if (!workerState) {
    throw new Error(`Worker not found: ${workerId}`);
  }

  // Check if tmux session exists
  if (!tmuxSessionExists(swarmState.session)) {
    throw new Error(`tmux session not found: ${swarmState.session}`);
  }

  // Stop the worker pane
  stopWorkerPane(swarmState.session, workerState.pane);

  // Remove worker from swarm state
  swarmState.workers = swarmState.workers.filter(w => w !== workerId);
  writeSwarmState(project, team, swarmState);

  // Delete worker state file
  const workerFile = getWorkerFile(project, team, workerId);
  if (fs.existsSync(workerFile)) {
    fs.unlinkSync(workerFile);
  }

  return {
    status: 'success',
    action: 'stopped',
    workers: [workerId]
  };
}

/**
 * Stop all workers (entire swarm)
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Object} Result object
 */
function stopAllWorkers(project, team) {
  const swarmState = readSwarmState(project, team);

  if (!swarmState) {
    throw new Error('Swarm not found');
  }

  // Check if tmux session exists
  if (!tmuxSessionExists(swarmState.session)) {
    throw new Error(`tmux session not found: ${swarmState.session}`);
  }

  // Kill entire tmux session
  stopTmuxSession(swarmState.session);

  // Clean up all worker state files
  const workersDir = path.join(getSwarmDir(project, team), 'workers');
  if (fs.existsSync(workersDir)) {
    const files = fs.readdirSync(workersDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(workersDir, file));
      }
    }
  }

  // Update swarm state
  swarmState.status = 'stopped';
  swarmState.workers = [];
  writeSwarmState(project, team, swarmState);

  return {
    status: 'success',
    action: 'stopped',
    workers: 'all'
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main execution function
 */
function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp(
      'swarm-stop.js',
      ARG_SPEC,
      'Stop a specific worker or the entire swarm\n\n' +
      'Examples:\n' +
      '  swarm-stop.js --project my-app --team master --worker w1\n' +
      '  swarm-stop.js --project my-app --team master --all'
    ));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Validate mutually exclusive options
  if (!args.worker && !args.all) {
    console.error('Error: Either --worker or --all is required');
    process.exit(1);
  }

  if (args.worker && args.all) {
    console.error('Error: Cannot use --worker and --all together');
    process.exit(1);
  }

  let result;

  if (args.worker) {
    // Stop specific worker
    result = stopWorker(args.project, args.team, args.worker);
  } else {
    // Stop all workers
    result = stopAllWorkers(args.project, args.team);
  }

  // Output result
  console.log(JSON.stringify(result, null, 2));
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
