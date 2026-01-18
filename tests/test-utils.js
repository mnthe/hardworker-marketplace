#!/usr/bin/env bun
/**
 * Shared Test Utilities
 * Common testing functions for ultrawork and teamwork plugins
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * @typedef {Object} TempDirResult
 * @property {string} path - Temporary directory path
 * @property {() => void} cleanup - Function to remove the temporary directory
 */

/**
 * @typedef {Object} MockSessionOptions
 * @property {string} [sessionId] - Custom session ID (default: random UUID)
 * @property {string} [workingDir] - Working directory path
 * @property {string} [goal] - Session goal
 * @property {string} [phase] - Session phase (PLANNING|EXECUTION|VERIFICATION|COMPLETE)
 * @property {string} [explorationStage] - Exploration stage (not_started|overview|analyzing|targeted|complete)
 */

/**
 * @typedef {Object} MockSessionResult
 * @property {string} sessionId - Session ID
 * @property {string} sessionDir - Session directory path
 * @property {string} sessionFile - session.json file path
 * @property {Object} sessionData - Session JSON data
 * @property {() => void} cleanup - Function to remove session directory
 */

/**
 * @typedef {Object} MockProjectOptions
 * @property {string} [project] - Project name
 * @property {string} [team] - Team name
 * @property {string} [goal] - Project goal
 * @property {string} [phase] - Project phase (PLANNING|EXECUTION|VERIFICATION|COMPLETE)
 */

/**
 * @typedef {Object} MockProjectResult
 * @property {string} project - Project name
 * @property {string} team - Team name
 * @property {string} projectDir - Project directory path
 * @property {string} projectFile - project.json file path
 * @property {string} tasksDir - Tasks directory path
 * @property {Object} projectData - Project JSON data
 * @property {() => void} cleanup - Function to remove project directory
 */

/**
 * @typedef {Object} ScriptResult
 * @property {number} exitCode - Exit code (0 = success)
 * @property {string} stdout - Standard output
 * @property {string} stderr - Standard error
 * @property {boolean} success - True if exit code is 0
 * @property {Object|null} json - Parsed JSON output (if stdout is valid JSON)
 */

// ============================================================================
// Temporary Directory Management
// ============================================================================

/**
 * Create a temporary directory for testing
 * @param {string} [prefix='test-'] - Directory name prefix
 * @returns {TempDirResult} Temporary directory path and cleanup function
 */
function createTempDir(prefix = 'test-') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  const cleanup = () => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };

  return { path: tmpDir, cleanup };
}

// ============================================================================
// Mock Session Creation (Ultrawork)
// ============================================================================

/**
 * Create a mock ultrawork session for testing
 * @param {MockSessionOptions} [options] - Session configuration options
 * @returns {MockSessionResult} Mock session data and cleanup function
 */
function mockSession(options = {}) {
  const sessionId = options.sessionId || `test-session-${Date.now()}`;
  const workingDir = options.workingDir || '/tmp/test-project';
  const goal = options.goal || 'Test session goal';
  const phase = options.phase || 'PLANNING';
  const explorationStage = options.explorationStage || 'not_started';

  // Create session directory structure
  const sessionDir = path.join(os.tmpdir(), '.claude', 'ultrawork', 'sessions', sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'exploration'), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'evidence'), { recursive: true });

  // Create session.json with valid structure
  const sessionData = {
    version: '6.0',
    session_id: sessionId,
    working_dir: workingDir,
    goal: goal,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phase: phase,
    exploration_stage: explorationStage,
    iteration: 1,
    plan: {
      approved_at: null
    },
    options: {
      max_workers: 0,
      max_iterations: 5,
      skip_verify: false,
      plan_only: false,
      auto_mode: false
    },
    evidence_log: [],
    cancelled_at: null
  };

  const sessionFile = path.join(sessionDir, 'session.json');
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');

  // Create context.json
  const contextData = {
    version: '2.1',
    expected_explorers: ['overview'],
    exploration_complete: false,
    explorers: [],
    key_files: [],
    patterns: [],
    constraints: []
  };
  fs.writeFileSync(
    path.join(sessionDir, 'context.json'),
    JSON.stringify(contextData, null, 2),
    'utf-8'
  );

  const cleanup = () => {
    const baseDir = path.join(os.tmpdir(), '.claude', 'ultrawork');
    if (fs.existsSync(baseDir)) {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  };

  return {
    sessionId,
    sessionDir,
    sessionFile,
    sessionData,
    cleanup
  };
}

// ============================================================================
// Mock Project Creation (Teamwork)
// ============================================================================

// Test isolation: Use TEAMWORK_TEST_BASE_DIR if set, otherwise use tmpdir/.claude/teamwork
// This ensures consistency between mockProject() and scripts using project-utils.js
const TEAMWORK_TEST_BASE_DIR = process.env.TEAMWORK_TEST_BASE_DIR || path.join(os.tmpdir(), 'teamwork-test');

/**
 * Create a mock teamwork project for testing
 * @param {MockProjectOptions} [options] - Project configuration options
 * @returns {MockProjectResult} Mock project data and cleanup function
 */
function mockProject(options = {}) {
  const project = options.project || 'test-project';
  const team = options.team || 'test-team';
  const goal = options.goal || 'Test project goal';
  const phase = options.phase || 'PLANNING';

  // Create project directory structure using the test base directory
  const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, project, team);
  fs.mkdirSync(projectDir, { recursive: true });

  const tasksDir = path.join(projectDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });

  const verificationDir = path.join(projectDir, 'verification');
  fs.mkdirSync(verificationDir, { recursive: true });

  // Create project.json with valid structure
  const projectData = {
    project: project,
    team: team,
    goal: goal,
    phase: phase,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: {
      total: 0,
      open: 0,
      in_progress: 0,
      resolved: 0
    }
  };

  const projectFile = path.join(projectDir, 'project.json');
  fs.writeFileSync(projectFile, JSON.stringify(projectData, null, 2), 'utf-8');

  const cleanup = () => {
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  };

  return {
    project,
    team,
    projectDir,
    projectFile,
    tasksDir,
    projectData,
    cleanup
  };
}

// ============================================================================
// Script Execution Helper
// ============================================================================

/**
 * Execute a Bun script with parameters and capture output
 * @param {string} scriptPath - Absolute path to the script
 * @param {Object.<string, string>} [params] - Script parameters as key-value pairs
 * @param {Object} [options] - Spawn options
 * @returns {ScriptResult} Script execution result
 */
function runScript(scriptPath, params = {}, options = {}) {
  // Convert params object to args array
  const args = [scriptPath];
  for (const [key, value] of Object.entries(params)) {
    args.push(`--${key}`, value);
  }

  // Merge environment variables - always include test isolation vars
  const env = {
    ...process.env,
    TEAMWORK_TEST_BASE_DIR: TEAMWORK_TEST_BASE_DIR,
    ...(options.env || {})
  };

  // Execute script with bun
  const result = spawnSync('bun', args, {
    encoding: 'utf-8',
    ...options,
    env
  });

  // Parse JSON output if possible
  let json = null;
  try {
    // First, try to parse the entire stdout as JSON (backward compatibility)
    json = JSON.parse(result.stdout);
  } catch {
    // If that fails, try to extract JSON from multi-line output
    // Scripts often output "OK: message\n{json}"
    const lines = result.stdout.split('\n');

    // Find lines that start with '{' or '[' (JSON start)
    const jsonLines = [];
    let inJson = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        inJson = true;
      }
      if (inJson && trimmed) {
        jsonLines.push(line);
      }
    }

    // Try to parse the extracted JSON lines
    if (jsonLines.length > 0) {
      try {
        json = JSON.parse(jsonLines.join('\n'));
      } catch {
        // Still not valid JSON, that's fine
      }
    }
  }

  return {
    exitCode: result.status || 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    success: (result.status || 0) === 0,
    json
  };
}

// ============================================================================
// JSON Schema Validation
// ============================================================================

/**
 * Assert that JSON data matches expected schema
 * @param {Object} data - JSON data to validate
 * @param {Object} schema - Expected schema (object with field names and types)
 * @throws {Error} If validation fails
 */
function assertJsonSchema(data, schema) {
  // Check if data is an object
  if (typeof data !== 'object' || data === null) {
    throw new Error(`Expected object, got ${typeof data}`);
  }

  // Validate each field in schema
  for (const [field, expectedType] of Object.entries(schema)) {
    // Check if field exists
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }

    const actualValue = data[field];
    const actualType = Array.isArray(actualValue) ? 'array' : typeof actualValue;

    // Handle special type checks
    if (expectedType === 'array') {
      if (!Array.isArray(actualValue)) {
        throw new Error(`Field "${field}" should be array, got ${actualType}`);
      }
    } else if (expectedType === 'object') {
      if (typeof actualValue !== 'object' || actualValue === null) {
        throw new Error(`Field "${field}" should be object, got ${actualType}`);
      }
    } else if (typeof expectedType === 'object' && !Array.isArray(expectedType)) {
      // Nested object validation
      assertJsonSchema(actualValue, expectedType);
    } else if (expectedType === 'string|null') {
      if (typeof actualValue !== 'string' && actualValue !== null) {
        throw new Error(`Field "${field}" should be string or null, got ${actualType}`);
      }
    } else {
      // Simple type check
      if (actualType !== expectedType) {
        throw new Error(`Field "${field}" should be ${expectedType}, got ${actualType}`);
      }
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  createTempDir,
  mockSession,
  mockProject,
  runScript,
  assertJsonSchema,
  // Test isolation constants
  TEAMWORK_TEST_BASE_DIR
};
