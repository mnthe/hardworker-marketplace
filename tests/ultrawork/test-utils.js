#!/usr/bin/env bun
/**
 * Shared test utilities for ultrawork script tests
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { getSessionDir, getSessionFile } = require('../../plugins/ultrawork/src/lib/session-utils.js');

/**
 * Create a temporary session directory for testing
 * @param {string} sessionId - Session ID
 * @param {Object} [options] - Session options
 * @returns {Object} Session info with cleanup function
 */
function createMockSession(sessionId, options = {}) {
  const sessionDir = getSessionDir(sessionId);
  const sessionFile = getSessionFile(sessionId);

  // Create directory structure
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'exploration'), { recursive: true });

  // Create session.json
  const sessionData = {
    version: '6.0',
    session_id: sessionId,
    working_dir: options.working_dir || '/tmp/test-project',
    goal: options.goal || 'Test session goal',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phase: options.phase || 'PLANNING',
    exploration_stage: options.exploration_stage || 'not_started',
    iteration: options.iteration || 1,
    plan: {
      approved_at: options.plan_approved_at || null
    },
    options: {
      max_workers: options.max_workers || 0,
      max_iterations: options.max_iterations || 5,
      skip_verify: options.skip_verify || false,
      plan_only: options.plan_only || false,
      auto_mode: options.auto_mode || false
    },
    evidence_log: options.evidence_log || [],
    cancelled_at: options.cancelled_at || null
  };

  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');

  // Create context.json
  const contextData = {
    version: '2.1',
    expected_explorers: options.expected_explorers || [],
    exploration_complete: options.exploration_complete || false,
    explorers: options.explorers || [],
    key_files: options.key_files || [],
    patterns: options.patterns || [],
    constraints: options.constraints || []
  };

  const contextFile = path.join(sessionDir, 'context.json');
  fs.writeFileSync(contextFile, JSON.stringify(contextData, null, 2), 'utf-8');

  return {
    sessionId,
    sessionDir,
    sessionFile,
    sessionData,
    contextData,
    cleanup: () => {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    }
  };
}

/**
 * Create a mock task file
 * @param {string} sessionId - Session ID
 * @param {string} taskId - Task ID
 * @param {Object} [options] - Task options
 * @returns {Object} Task info
 */
function createMockTask(sessionId, taskId, options = {}) {
  const sessionDir = getSessionDir(sessionId);
  const tasksDir = path.join(sessionDir, 'tasks');
  const taskFile = path.join(tasksDir, `${taskId}.json`);

  const taskData = {
    id: taskId,
    subject: options.subject || 'Test task',
    description: options.description || 'Test task description',
    complexity: options.complexity || 'standard',
    status: options.status || 'open',
    blocked_by: options.blocked_by || [],
    criteria: options.criteria || ['Test criterion'],
    evidence: options.evidence || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(options.approach && { approach: options.approach }),
    ...(options.test_file && { test_file: options.test_file })
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
 * @param {string} scriptPath - Path to script
 * @param {string[]} args - Script arguments
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
async function runScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const proc = spawn('bun', [scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
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

module.exports = {
  createMockSession,
  createMockTask,
  runScript,
  assertJsonSchema,
  assertHelpText
};
