#!/usr/bin/env bun
/**
 * Teamwork-specific test utilities
 *
 * IMPORTANT: Uses os.tmpdir() to isolate tests from real user data.
 * Never use real ~/.claude/ paths in tests!
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Test-specific path functions (isolated from real user data)
const TEST_BASE_DIR = path.join(os.tmpdir(), 'teamwork-test');

function getTestTeamworkBase() {
  return TEST_BASE_DIR;
}

function getTestProjectDir(project, team) {
  return path.join(TEST_BASE_DIR, project, team);
}

function getTestProjectFile(project, team) {
  return path.join(getTestProjectDir(project, team), 'project.json');
}

function getTestTasksDir(project, team) {
  return path.join(getTestProjectDir(project, team), 'tasks');
}

function getTestTaskFile(project, team, taskId) {
  return path.join(getTestTasksDir(project, team), `${taskId}.json`);
}

/**
 * Create a mock project directory for testing
 * Uses os.tmpdir() to avoid affecting real user projects
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {Object} [options] - Project options
 * @returns {Object} Project info with cleanup function
 */
function createMockProject(project, team, options = {}) {
  const projectDir = getTestProjectDir(project, team);
  const projectFile = getTestProjectFile(project, team);
  const tasksDir = getTestTasksDir(project, team);

  // Create directory structure
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'verification'), { recursive: true });

  // Create project.json
  const projectData = {
    project: project,
    team: team,
    goal: options.goal || 'Test project goal',
    phase: options.phase || 'PLANNING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: {
      total: options.total || 0,
      open: options.open || 0,
      in_progress: options.in_progress || 0,
      resolved: options.resolved || 0
    }
  };

  fs.writeFileSync(projectFile, JSON.stringify(projectData, null, 2), 'utf-8');

  // Create waves.json if wave data provided
  if (options.waves) {
    const wavesFile = path.join(projectDir, 'waves.json');
    fs.writeFileSync(wavesFile, JSON.stringify(options.waves, null, 2), 'utf-8');
  }

  return {
    project,
    team,
    projectDir,
    projectFile,
    tasksDir,
    projectData,
    cleanup: () => {
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    }
  };
}

/**
 * Create a mock task file
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} taskId - Task ID
 * @param {Object} [options] - Task options
 * @returns {Object} Task info
 */
function createMockTask(project, team, taskId, options = {}) {
  const tasksDir = getTestTasksDir(project, team);
  const taskFile = path.join(tasksDir, `${taskId}.json`);

  // Ensure tasks directory exists
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  const taskData = {
    id: taskId,
    title: options.title || 'Test task',
    description: options.description || 'Test task description',
    role: options.role || 'backend',
    complexity: options.complexity || 'standard',
    status: options.status || 'open',
    blocked_by: options.blocked_by || [],
    wave: options.wave || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    claimed_by: options.claimed_by || null,
    claimed_at: options.claimed_at || null,
    completed_at: options.completed_at || null,
    evidence: options.evidence || []
  };

  fs.writeFileSync(taskFile, JSON.stringify(taskData, null, 2), 'utf-8');

  return {
    taskId,
    taskFile,
    taskData
  };
}

/**
 * Run a script with given arguments
 * Automatically sets TEAMWORK_TEST_BASE_DIR for test isolation
 * @param {string} scriptPath - Path to script
 * @param {string[]} args - Script arguments
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
async function runScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const proc = spawn('bun', [scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TEAMWORK_TEST_BASE_DIR: TEST_BASE_DIR  // Isolate tests from real user data
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode || 0
      });
    });
  });
}

/**
 * Assert that output matches JSON schema structure
 * @param {string} output - Output string to validate
 * @param {Object} schema - Expected schema structure
 * @returns {Object} Parsed JSON object
 */
function assertJsonSchema(output, schema) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (e) {
    throw new Error(`Invalid JSON output: ${e.message}\nOutput: ${output}`);
  }

  // Check required fields
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in parsed)) {
      throw new Error(`Missing required field: ${key}`);
    }

    const actualType = Array.isArray(parsed[key]) ? 'array' : typeof parsed[key];
    if (actualType !== type && parsed[key] !== null) {
      throw new Error(`Field ${key} has wrong type: expected ${type}, got ${actualType}`);
    }
  }

  return parsed;
}

/**
 * Parse help text and check for required elements
 * @param {string} helpText - Help text output
 * @param {string[]} requiredFlags - Required flags that must appear
 * @returns {boolean}
 */
function assertHelpText(helpText, requiredFlags = []) {
  if (!helpText.includes('Usage:')) {
    throw new Error('Help text missing "Usage:" section');
  }

  if (!helpText.includes('Options:')) {
    throw new Error('Help text missing "Options:" section');
  }

  for (const flag of requiredFlags) {
    if (!helpText.includes(flag)) {
      throw new Error(`Help text missing required flag: ${flag}`);
    }
  }

  return true;
}

/**
 * Clean up all test projects (call in afterAll or when needed)
 */
function cleanupAllTestProjects() {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
}

module.exports = {
  // Path helpers (for test isolation)
  TEST_BASE_DIR,
  getTestTeamworkBase,
  getTestProjectDir,
  getTestProjectFile,
  getTestTasksDir,
  getTestTaskFile,
  // Project/task creation
  createMockProject,
  createMockTask,
  // Script execution
  runScript,
  // Assertions
  assertJsonSchema,
  assertHelpText,
  // Cleanup
  cleanupAllTestProjects
};
