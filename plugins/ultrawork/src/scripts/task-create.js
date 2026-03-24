#!/usr/bin/env bun
/**
 * task-create.js - Create new task JSON file
 * CLI to create task files with validation
 *
 * Usage: task-create.js --session <ID> --id <id> --subject "..." [options]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getSessionDir, readSession } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { writeJsonAtomically } = require('../lib/json-ops.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').Complexity} Complexity
 * @typedef {import('../lib/types.js').TaskApproach} TaskApproach
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} [session]
 * @property {string} [id]
 * @property {string} [subject]
 * @property {string} [description]
 * @property {Complexity} [complexity]
 * @property {string} [criteria]
 * @property {string} [blockedBy]
 * @property {TaskApproach} [approach]
 * @property {string} [descriptionFile]
 * @property {string} [testFile]
 * @property {string} [testScope]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--session': { key: 'session', aliases: ['-s'], required: true },
  '--id': { key: 'id', aliases: ['-i', '--task', '--task-id'], required: true },
  '--subject': { key: 'subject', aliases: ['-S'], required: true },
  '--description': { key: 'description', aliases: ['-d'] },
  '--description-file': { key: 'descriptionFile', aliases: ['-D'] },
  '--complexity': { key: 'complexity', aliases: ['-c'], default: 'standard' },
  '--criteria': { key: 'criteria', aliases: ['-C'] },
  '--blocked-by': { key: 'blockedBy', aliases: ['-b'] },
  '--approach': { key: 'approach', aliases: ['-a'], default: 'tdd' },
  '--test-file': { key: 'testFile', aliases: ['-t'] },
  '--test-scope': { key: 'testScope', aliases: ['-T', '--scope'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate CLI arguments
 * @param {CliArgs} args - Arguments to validate
 * @returns {void}
 */
function validateArgs(args) {
  // Required args already validated by parseArgs

  // Validate complexity if provided
  if (args.complexity) {
    /** @type {Complexity[]} */
    const validComplexities = ['simple', 'standard', 'complex'];
    if (!validComplexities.includes(args.complexity)) {
      console.error(`Error: Invalid complexity "${args.complexity}". Must be: simple, standard, or complex`);
      process.exit(1);
    }
  }

  // Validate approach if provided
  if (args.approach) {
    /** @type {TaskApproach[]} */
    const validApproaches = ['standard', 'tdd'];
    if (!validApproaches.includes(args.approach)) {
      console.error(`Error: Invalid approach "${args.approach}". Must be: standard or tdd`);
      process.exit(1);
    }
  }

  // Validate --description and --description-file are mutually exclusive
  if (args.description && args.descriptionFile) {
    console.error('Error: --description and --description-file cannot be used together');
    process.exit(1);
  }

  // Validate --description-file exists
  if (args.descriptionFile && !fs.existsSync(args.descriptionFile)) {
    console.error(`Error: Description file does not exist: ${args.descriptionFile}`);
    process.exit(1);
  }

  // Validate test-file requires tdd approach
  if (args.testFile && args.approach !== 'tdd') {
    console.error('Error: --test-file requires --approach tdd');
    process.exit(1);
  }
}

// ============================================================================
// Doc-Review Gate
// ============================================================================

/**
 * Check if codex CLI is available on the system
 * @returns {boolean}
 */
function isCodexInstalled() {
  try {
    execSync('which codex', { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check doc-review gate during PLANNING phase.
 * Blocks task creation if Codex doc-review has not passed.
 * @param {string} sessionId - Session ID
 * @returns {void}
 */
function checkDocReviewGate(sessionId) {
  let session;
  try {
    session = readSession(sessionId);
  } catch {
    return; // Session not found - skip gate
  }

  if (session.phase !== 'PLANNING') {
    return; // Gate only applies during PLANNING phase
  }

  const resultPath = `/tmp/codex-doc-${sessionId}.json`;

  if (!fs.existsSync(resultPath)) {
    if (!isCodexInstalled()) {
      return; // Graceful degradation: Codex not installed
    }
    console.error('Error: Codex doc-review must pass before creating tasks during PLANNING phase.\nRun codex-verify.js --mode doc-review first.');
    process.exit(1);
  }

  try {
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
    if (result.verdict === 'PASS' || result.verdict === 'SKIP') {
      return; // Gate passed
    }
  } catch {
    return; // Corrupt file - graceful degradation
  }

  console.error('Error: Codex doc-review returned FAIL. Fix the design document and re-run doc-review before creating tasks.');
  process.exit(1);
}

// ============================================================================
// Task Creation
// ============================================================================

/**
 * Parse criteria string into array
 * @param {string} criteriaStr - Pipe-separated criteria string
 * @returns {string[]} Array of criteria
 */
function parseCriteria(criteriaStr) {
  if (!criteriaStr || criteriaStr.trim() === '') {
    return [];
  }

  return criteriaStr
    .split('|')
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

/**
 * Parse blocked-by string into array
 * @param {string} blockedByStr - Comma-separated task IDs
 * @returns {string[]} Array of task IDs
 */
function parseBlockedBy(blockedByStr) {
  if (!blockedByStr || blockedByStr.trim() === '') {
    return [];
  }

  return blockedByStr
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

/**
 * Create task file
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function createTask(args) {
  checkDocReviewGate(args.session);

  // Read description from file if --description-file is provided
  if (args.descriptionFile) {
    args.description = fs.readFileSync(args.descriptionFile, 'utf-8').trim();
  }

  const sessionDir = getSessionDir(args.session);
  const tasksDir = path.join(sessionDir, 'tasks');
  const taskFile = path.join(tasksDir, `${args.id}.json`);

  // Check if task already exists
  if (fs.existsSync(taskFile)) {
    console.error(`Error: Task ${args.id} already exists`);
    process.exit(1);
  }

  // Build task object
  const now = new Date().toISOString();
  /** @type {Task} */
  const task = {
    id: args.id,
    subject: args.subject,
    description: args.description || args.subject,
    complexity: args.complexity || 'standard',
    status: 'open',
    blocked_by: parseBlockedBy(args.blockedBy || ''),
    criteria: parseCriteria(args.criteria || ''),
    evidence: [],
    created_at: now,
    updated_at: now
  };

  // Add TDD fields if specified
  if (args.approach) {
    task.approach = args.approach;
  }
  if (args.testFile) {
    task.test_file = args.testFile;
  }
  if (args.testScope) {
    task.test_scope = args.testScope;
  }

  // Write task JSON
  writeJsonAtomically(taskFile, task, { ensureDir: true });

  // Output success message and task JSON
  console.log(`OK: Task ${args.id} created`);
  console.log(JSON.stringify(task, null, 2));
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
    // Check for help flag first (before validation)
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(generateHelp('task-create.js', ARG_SPEC, 'Create new task JSON file with validation and success criteria'));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC);

    validateArgs(args);
    createTask(args);
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
