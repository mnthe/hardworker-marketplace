/**
 * Teamwork Project Utilities
 * Common functions for teamwork project path management
 * Modeled after ultrawork-js/src/lib/session-utils.js
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

// Import types for JSDoc
/**
 * @typedef {import('./types').Project} Project
 * @typedef {import('./types').Task} Task
 * @typedef {import('./types').TaskStatus} TaskStatus
 */

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Get the base teamwork directory
 * @returns {string} ~/.claude/teamwork
 */
function getTeamworkBase() {
  return path.join(os.homedir(), '.claude', 'teamwork');
}

/**
 * Get project directory for a specific project and team
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Project directory path
 */
function getProjectDir(project, team) {
  return path.join(getTeamworkBase(), project, team);
}

/**
 * Get session.json path for a project
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Session file path
 */
function getProjectFile(project, team) {
  return path.join(getProjectDir(project, team), 'session.json');
}

/**
 * Get tasks directory for a project
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Tasks directory path
 */
function getTasksDir(project, team) {
  return path.join(getProjectDir(project, team), 'tasks');
}

/**
 * Get task file path for a specific task
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} taskId - Task ID
 * @returns {string} Task file path
 */
function getTaskFile(project, team, taskId) {
  return path.join(getTasksDir(project, team), `${taskId}.json`);
}

// ============================================================================
// Project Validation
// ============================================================================

/**
 * Validate project exists and return project file path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Project file path
 * @throws {Error} If project doesn't exist
 */
function resolveProject(project, team) {
  if (!project) {
    throw new Error('Project name is required');
  }
  if (!team) {
    throw new Error('Team name is required');
  }

  const projectFile = getProjectFile(project, team);

  if (!fs.existsSync(projectFile)) {
    throw new Error(
      `Project not found: ${project}/${team}\nExpected file: ${projectFile}`
    );
  }

  return projectFile;
}

/**
 * Check if project exists
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {boolean} True if project exists
 */
function projectExists(project, team) {
  const projectFile = getProjectFile(project, team);
  return fs.existsSync(projectFile);
}

/**
 * List all tasks in a project
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string[]} Array of task IDs
 */
function listTaskIds(project, team) {
  const tasksDir = getTasksDir(project, team);

  if (!fs.existsSync(tasksDir)) {
    return [];
  }

  const files = fs.readdirSync(tasksDir);
  return files
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace('.json', ''));
}

// ============================================================================
// JSON Operations
// ============================================================================

/**
 * Read project session data
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Project} Project data
 */
function readProject(project, team) {
  const projectFile = resolveProject(project, team);
  const content = fs.readFileSync(projectFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Read task data
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} taskId - Task ID
 * @returns {Task} Task data
 * @throws {Error} If task doesn't exist
 */
function readTask(project, team, taskId) {
  const taskFile = getTaskFile(project, team, taskId);

  if (!fs.existsSync(taskFile)) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const content = fs.readFileSync(taskFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write task data atomically
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} taskId - Task ID
 * @param {Task} taskData - Task data to write
 * @returns {void}
 */
function writeTask(project, team, taskId, taskData) {
  const taskFile = getTaskFile(project, team, taskId);
  const tasksDir = getTasksDir(project, team);

  // Ensure tasks directory exists
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  // Update timestamp
  taskData.updated_at = new Date().toISOString();

  // Write atomically using temp file
  const tmpFile = `${taskFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(taskData, null, 2), 'utf-8');
  fs.renameSync(tmpFile, taskFile);
}

/**
 * Write project session data atomically
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {Project} projectData - Project data to write
 * @returns {void}
 */
function writeProject(project, team, projectData) {
  const projectFile = getProjectFile(project, team);
  const projectDir = getProjectDir(project, team);

  // Ensure project directory exists
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Update timestamp
  projectData.updated_at = new Date().toISOString();

  // Write atomically using temp file
  const tmpFile = `${projectFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(projectData, null, 2), 'utf-8');
  fs.renameSync(tmpFile, projectFile);
}

/**
 * List all tasks with optional status filter
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {TaskStatus} [statusFilter] - Optional status filter
 * @returns {Task[]} Array of tasks
 */
function listTasks(project, team, statusFilter) {
  const taskIds = listTaskIds(project, team);
  const tasks = [];

  for (const taskId of taskIds) {
    try {
      const task = readTask(project, team, taskId);
      if (!statusFilter || task.status === statusFilter) {
        tasks.push(task);
      }
    } catch {
      // Skip invalid task files
      continue;
    }
  }

  return tasks;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update project statistics by counting tasks
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {void}
 */
function updateProjectStats(project, team) {
  const projectData = readProject(project, team);
  const tasks = listTasks(project, team);

  projectData.stats = {
    total: tasks.length,
    open: tasks.filter((t) => t.status === 'open').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    resolved: tasks.filter((t) => t.status === 'resolved').length,
  };

  writeProject(project, team, projectData);
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  getTeamworkBase,
  getProjectDir,
  getProjectFile,
  getTasksDir,
  getTaskFile,
  resolveProject,
  projectExists,
  listTaskIds,
  readProject,
  readTask,
  writeTask,
  writeProject,
  listTasks,
  updateProjectStats,
};
