#!/usr/bin/env bun
/**
 * Shared Test Utilities
 * Common testing functions for ultrawork and teamwork plugins
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawnSync, spawn } = require('child_process');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * @typedef {Object} TempDirResult
 * @property {string} path - Temporary directory path
 * @property {() => void} cleanup - Function to remove the temporary directory
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
// Test Isolation Constants
// ============================================================================

// Test isolation: Use TEAMWORK_TEST_BASE_DIR if set, otherwise use tmpdir/teamwork-test
const TEAMWORK_TEST_BASE_DIR = process.env.TEAMWORK_TEST_BASE_DIR || path.join(os.tmpdir(), 'teamwork-test');

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
// Help Text Assertion
// ============================================================================

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

// ============================================================================
// Async Script Execution Helper
// ============================================================================

/**
 * Run a script asynchronously and capture output
 * @param {string} scriptPath - Path to script
 * @param {string[]} args - Script arguments
 * @param {Object} [options] - Additional options
 * @param {Object} [options.env] - Additional environment variables (merged with process.env)
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
async function runScriptAsync(scriptPath, args = [], options = {}) {
  return new Promise((resolve) => {
    const proc = spawn('bun', [scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(options.env || {})
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

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  createTempDir,
  runScript,
  assertJsonSchema,
  assertHelpText,
  runScriptAsync,
  // Test isolation constants
  TEAMWORK_TEST_BASE_DIR
};
