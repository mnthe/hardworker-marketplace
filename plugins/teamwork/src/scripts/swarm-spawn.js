#!/usr/bin/env bun
/**
 * Swarm Spawn Script
 * Creates tmux session/panes and spawns workers
 *
 * Usage: swarm-spawn.js --project <name> --team <name> --role <role> [options]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir } = require('../lib/project-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--role': { key: 'role', aliases: ['-r'] },
  '--roles': { key: 'roles' },
  '--count': { key: 'count', aliases: ['-c'] },
  '--worktree': { key: 'worktree', flag: true },
  '--session-name': { key: 'sessionName', aliases: ['-s'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// TMux Operations
// ============================================================================

/**
 * Check if tmux is available
 * @returns {boolean}
 */
function isTmuxAvailable() {
  const result = spawnSync('which', ['tmux'], { encoding: 'utf-8' });
  return result.status === 0;
}

/**
 * Check if tmux session exists
 * @param {string} sessionName
 * @returns {boolean}
 */
function sessionExists(sessionName) {
  const result = spawnSync('tmux', ['has-session', '-t', sessionName], {
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  return result.status === 0;
}

/**
 * Create tmux session
 * @param {string} sessionName
 * @returns {boolean} Success
 */
function createSession(sessionName) {
  const result = spawnSync('tmux', ['new-session', '-d', '-s', sessionName, '-n', 'main'], {
    encoding: 'utf-8'
  });
  return result.status === 0;
}

/**
 * Split tmux pane
 * @param {string} sessionName
 * @param {string} targetPane - e.g., "main.0"
 * @param {string} direction - "h" for horizontal, "v" for vertical
 * @returns {boolean} Success
 */
function splitPane(sessionName, targetPane, direction) {
  const flag = direction === 'h' ? '-h' : '-v';
  const result = spawnSync('tmux', ['split-window', flag, '-t', `${sessionName}:${targetPane}`], {
    encoding: 'utf-8'
  });
  return result.status === 0;
}

/**
 * Send keys to tmux pane
 * @param {string} sessionName
 * @param {string} pane - e.g., "main.0"
 * @param {string} keys - Keys to send (use "Enter" for newline)
 */
function sendKeys(sessionName, pane, keys) {
  spawnSync('tmux', ['send-keys', '-t', `${sessionName}:${pane}`, keys, 'Enter'], {
    encoding: 'utf-8'
  });
}

/**
 * Set pane title
 * @param {string} sessionName
 * @param {string} pane - e.g., "main.0"
 * @param {string} title - Pane title
 */
function setPaneTitle(sessionName, pane, title) {
  spawnSync('tmux', ['select-pane', '-t', `${sessionName}:${pane}`, '-T', title], {
    encoding: 'utf-8'
  });
}

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Generate worker ID
 * @param {number} index
 * @returns {string}
 */
function generateWorkerId(index) {
  return `w${index + 1}`;
}

/**
 * Get worktree path for worker
 * @param {string} projectDir
 * @param {string} workerId
 * @returns {string}
 */
function getWorktreePath(projectDir, workerId) {
  return path.join(projectDir, 'worktrees', workerId);
}

/**
 * Create worker info object
 * @param {string} workerId
 * @param {string} role
 * @param {number} paneIndex
 * @param {string|null} worktreePath
 * @returns {Object}
 */
function createWorkerInfo(workerId, role, paneIndex, worktreePath) {
  return {
    id: workerId,
    role,
    pane: paneIndex,
    worktree: worktreePath
  };
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Create swarm state directory
 * @param {string} projectDir
 */
function createSwarmDir(projectDir) {
  const swarmDir = path.join(projectDir, 'swarm');
  const workersDir = path.join(swarmDir, 'workers');

  if (!fs.existsSync(swarmDir)) {
    fs.mkdirSync(swarmDir, { recursive: true });
  }

  if (!fs.existsSync(workersDir)) {
    fs.mkdirSync(workersDir, { recursive: true });
  }

  return swarmDir;
}

/**
 * Write swarm.json state file (merges with existing workers)
 * @param {string} swarmDir
 * @param {string} sessionName
 * @param {Array<Object>} newWorkers - New workers to add
 * @param {boolean} useWorktree
 * @param {string} sourceDir
 */
function writeSwarmState(swarmDir, sessionName, newWorkers, useWorktree, sourceDir) {
  const swarmFile = path.join(swarmDir, 'swarm.json');

  // Read existing swarm.json if it exists
  let existingWorkers = [];
  if (fs.existsSync(swarmFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(swarmFile, 'utf-8'));
      existingWorkers = existing.workers || [];
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  // Merge workers: existing + new (avoiding duplicates)
  const newWorkerIds = newWorkers.map(w => w.id);
  const mergedWorkers = [
    ...existingWorkers.filter(id => !newWorkerIds.includes(id)),
    ...newWorkerIds
  ];

  const swarmData = {
    session: sessionName,
    status: 'running',
    created_at: new Date().toISOString(),
    workers: mergedWorkers,
    current_wave: null,
    paused: false,
    use_worktree: useWorktree,
    source_dir: sourceDir
  };

  fs.writeFileSync(swarmFile, JSON.stringify(swarmData, null, 2), 'utf-8');
}

/**
 * Write worker state files
 * @param {string} swarmDir
 * @param {Array<Object>} workers
 */
function writeWorkerStates(swarmDir, workers) {
  const workersDir = path.join(swarmDir, 'workers');

  for (const worker of workers) {
    const workerData = {
      id: worker.id,
      role: worker.role,
      pane: worker.pane,
      worktree: worker.worktree,
      branch: worker.worktree ? `worker-${worker.id}` : null,
      status: 'idle',
      current_task: null,
      tasks_completed: [],
      last_heartbeat: new Date().toISOString()
    };

    const workerFile = path.join(workersDir, `${worker.id}.json`);
    fs.writeFileSync(workerFile, JSON.stringify(workerData, null, 2), 'utf-8');
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main execution function
 */
function main() {
  // Check for help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp(
      'swarm-spawn.js',
      ARG_SPEC,
      'Create tmux session and spawn teamwork workers'
    ));
    process.exit(0);
  }

  // Parse arguments
  const args = parseArgs(ARG_SPEC);

  // Validate role/roles parameter
  if (!args.role && !args.roles) {
    console.error('Error: Either --role or --roles parameter required');
    process.exit(1);
  }

  // Check tmux availability
  if (!isTmuxAvailable()) {
    console.error('Error: tmux is not installed or not in PATH');
    process.exit(1);
  }

  // Parse roles
  let rolesList = [];
  if (args.roles) {
    rolesList = args.roles.split(',').map(r => r.trim());
  } else if (args.role) {
    rolesList = [args.role];
  }

  // Parse count
  const count = args.count ? parseInt(args.count, 10) : 1;
  if (isNaN(count) || count < 1) {
    console.error('Error: --count must be a positive integer');
    process.exit(1);
  }

  // Generate workers list (expand roles by count)
  const workers = [];
  for (const role of rolesList) {
    for (let i = 0; i < count; i++) {
      workers.push({
        role,
        index: workers.length
      });
    }
  }

  // Determine session name
  const sessionName = args.sessionName || `teamwork-${args.project}`;

  // Get project directory
  const projectDir = getProjectDir(args.project, args.team);

  // Check if project exists
  if (!fs.existsSync(projectDir)) {
    console.error(`Error: Project not found: ${args.project}/${args.team}`);
    process.exit(1);
  }

  // Create or attach to tmux session
  if (!sessionExists(sessionName)) {
    if (!createSession(sessionName)) {
      console.error(`Error: Failed to create tmux session: ${sessionName}`);
      process.exit(1);
    }
  }

  // Create panes and spawn workers
  const workerInfos = [];

  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i];
    const workerId = generateWorkerId(i);
    const paneIndex = i;

    // Split pane if not first worker
    if (i > 0) {
      const direction = i % 2 === 0 ? 'v' : 'h';
      const targetPane = `main.${Math.floor((i - 1) / 2)}`;
      splitPane(sessionName, targetPane, direction);
    }

    // Determine worktree path
    const worktreePath = args.worktree
      ? getWorktreePath(projectDir, workerId)
      : null;

    // Start worker in pane
    const paneName = `main.${paneIndex}`;

    // Change to working directory if worktree
    if (worktreePath) {
      sendKeys(sessionName, paneName, `cd ${worktreePath}`);
    }

    // Start Claude Code with teamwork-worker command as initial prompt
    // Pass the command directly to avoid timing issues between Claude startup and command input
    // Include --worker-id so the worker can register its session ID for state tracking
    const workerCommand = `/teamwork-worker --project ${args.project} --team ${args.team} --role ${worker.role} --worker-id ${workerId} --loop`;
    sendKeys(sessionName, paneName, `claude "${workerCommand}"`);

    // Set pane title
    setPaneTitle(sessionName, paneName, `${worker.role}-${workerId}`);

    // Record worker info
    workerInfos.push(createWorkerInfo(workerId, worker.role, paneIndex, worktreePath));
  }

  // Create swarm state directory
  const swarmDir = createSwarmDir(projectDir);

  // Write swarm state
  const sourceDir = process.cwd(); // Current working directory as source
  writeSwarmState(swarmDir, sessionName, workerInfos, args.worktree || false, sourceDir);

  // Write worker states
  writeWorkerStates(swarmDir, workerInfos);

  // Output success
  const result = {
    status: 'success',
    session: sessionName,
    workers: workerInfos
  };

  console.log(JSON.stringify(result, null, 2));
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
