#!/usr/bin/env bun
/**
 * Swarm State Management Library
 * Functions for managing swarm.json and workers/{id}.json state files
 * Pattern follows project-utils.js
 */

const fs = require('fs');
const path = require('path');
const { getProjectDir } = require('./project-utils.js');

// ============================================================================
// Path Resolution
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
 * Get worker state file path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @returns {string} Worker file path
 */
function getWorkerFile(project, team, workerId) {
  return path.join(getWorkersDir(project, team), `${workerId}.json`);
}

// ============================================================================
// Swarm State Management
// ============================================================================

/**
 * Create swarm.json state file
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {Object} data - Swarm state data
 * @param {string} data.session - Session name
 * @param {string} data.status - Swarm status ("running" | "stopped" | "paused")
 * @param {string[]} data.workers - Array of worker IDs
 * @param {number|null} [data.current_wave] - Current wave number
 * @param {boolean} [data.paused] - Whether swarm is paused
 * @param {boolean} [data.use_worktree] - Whether workers use worktrees
 * @param {string} [data.source_dir] - Source directory path
 * @returns {void}
 */
function createSwarmState(project, team, data) {
  const swarmDir = getSwarmDir(project, team);
  const swarmFile = getSwarmFile(project, team);

  // Ensure swarm directory exists
  if (!fs.existsSync(swarmDir)) {
    fs.mkdirSync(swarmDir, { recursive: true });
  }

  // Ensure workers directory exists
  const workersDir = getWorkersDir(project, team);
  if (!fs.existsSync(workersDir)) {
    fs.mkdirSync(workersDir, { recursive: true });
  }

  // Create swarm state with timestamps
  const swarmState = {
    session: data.session,
    status: data.status,
    created_at: new Date().toISOString(),
    workers: data.workers || [],
    current_wave: data.current_wave !== undefined ? data.current_wave : null,
    paused: data.paused !== undefined ? data.paused : false,
    use_worktree: data.use_worktree !== undefined ? data.use_worktree : false,
    source_dir: data.source_dir || null
  };

  // Write atomically using temp file
  const tmpFile = `${swarmFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(swarmState, null, 2), 'utf-8');
  fs.renameSync(tmpFile, swarmFile);
}

/**
 * Get swarm state
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Object} Swarm state data
 * @throws {Error} If swarm.json doesn't exist
 */
function getSwarmState(project, team) {
  const swarmFile = getSwarmFile(project, team);

  if (!fs.existsSync(swarmFile)) {
    throw new Error(`Swarm state not found: ${project}/${team}`);
  }

  const content = fs.readFileSync(swarmFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Update swarm state with partial data
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {Object} updates - Fields to update
 * @returns {void}
 */
function updateSwarmState(project, team, updates) {
  const swarmFile = getSwarmFile(project, team);

  // Read existing state
  const state = getSwarmState(project, team);

  // Merge updates
  const updatedState = {
    ...state,
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Write atomically
  const tmpFile = `${swarmFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(updatedState, null, 2), 'utf-8');
  fs.renameSync(tmpFile, swarmFile);
}

// ============================================================================
// Worker State Management
// ============================================================================

/**
 * Create worker state file
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @param {Object} data - Worker state data
 * @param {string} data.id - Worker ID
 * @param {string} data.role - Worker role
 * @param {number} data.pane - Pane index
 * @param {string|null} [data.worktree] - Worktree path
 * @param {string|null} [data.branch] - Git branch name
 * @param {string} [data.status] - Worker status ("idle" | "working" | "dead")
 * @param {string|null} [data.current_task] - Current task ID
 * @param {string[]} [data.tasks_completed] - Completed task IDs
 * @param {string} [data.last_heartbeat] - Last heartbeat timestamp
 * @returns {void}
 */
function createWorkerState(project, team, workerId, data) {
  const workerFile = getWorkerFile(project, team, workerId);
  const workersDir = getWorkersDir(project, team);

  // Ensure workers directory exists
  if (!fs.existsSync(workersDir)) {
    fs.mkdirSync(workersDir, { recursive: true });
  }

  // Create worker state
  const workerState = {
    id: data.id || workerId,
    role: data.role,
    pane: data.pane !== undefined ? data.pane : null,
    worktree: data.worktree || null,
    branch: data.branch || null,
    status: data.status || 'idle',
    current_task: data.current_task || null,
    tasks_completed: data.tasks_completed || [],
    last_heartbeat: data.last_heartbeat || new Date().toISOString()
  };

  // Write atomically
  const tmpFile = `${workerFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(workerState, null, 2), 'utf-8');
  fs.renameSync(tmpFile, workerFile);
}

/**
 * Get worker state
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @returns {Object} Worker state data
 * @throws {Error} If worker doesn't exist
 */
function getWorkerState(project, team, workerId) {
  const workerFile = getWorkerFile(project, team, workerId);

  if (!fs.existsSync(workerFile)) {
    throw new Error(`Worker not found: ${workerId}`);
  }

  const content = fs.readFileSync(workerFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Update worker state with partial data
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @param {Object} updates - Fields to update
 * @returns {void}
 */
function updateWorkerState(project, team, workerId, updates) {
  const workerFile = getWorkerFile(project, team, workerId);

  // Read existing state
  const state = getWorkerState(project, team, workerId);

  // Merge updates
  const updatedState = {
    ...state,
    ...updates
  };

  // Write atomically
  const tmpFile = `${workerFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(updatedState, null, 2), 'utf-8');
  fs.renameSync(tmpFile, workerFile);
}

/**
 * Get all worker states
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Object[]} Array of worker states
 */
function getAllWorkerStates(project, team) {
  const workersDir = getWorkersDir(project, team);

  // Return empty array if workers directory doesn't exist
  if (!fs.existsSync(workersDir)) {
    return [];
  }

  // Read all worker files
  const files = fs.readdirSync(workersDir);
  const workers = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      const workerId = file.replace('.json', '');
      try {
        const state = getWorkerState(project, team, workerId);
        workers.push(state);
      } catch {
        // Skip invalid worker files
        continue;
      }
    }
  }

  return workers;
}

/**
 * Update worker heartbeat timestamp
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @returns {void}
 */
function updateHeartbeat(project, team, workerId) {
  updateWorkerState(project, team, workerId, {
    last_heartbeat: new Date().toISOString()
  });
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Path functions
  getSwarmDir,
  getSwarmFile,
  getWorkersDir,
  getWorkerFile,

  // Swarm state management
  createSwarmState,
  getSwarmState,
  updateSwarmState,

  // Worker state management
  createWorkerState,
  getWorkerState,
  updateWorkerState,
  getAllWorkerStates,
  updateHeartbeat
};
