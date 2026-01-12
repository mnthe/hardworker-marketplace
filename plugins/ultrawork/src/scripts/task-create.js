#!/usr/bin/env bun
/**
 * task-create.js - Create new task JSON file
 * CLI to create task files with validation
 *
 * Usage: task-create.js --session <ID> --id <id> --subject "..." [options]
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

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
 * @property {string} [testFile]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--session': { key: 'session', alias: '-s', required: true },
  '--id': { key: 'id', alias: '-i', required: true },
  '--subject': { key: 'subject', alias: '-S', required: true },
  '--description': { key: 'description', alias: '-d' },
  '--complexity': { key: 'complexity', alias: '-c', default: 'standard' },
  '--criteria': { key: 'criteria', alias: '-C' },
  '--blocked-by': { key: 'blockedBy', alias: '-b' },
  '--approach': { key: 'approach', alias: '-a' },
  '--test-file': { key: 'testFile', alias: '-t' },
  '--help': { key: 'help', alias: '-h', flag: true }
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

  // Validate test-file requires tdd approach
  if (args.testFile && args.approach !== 'tdd') {
    console.error('Error: --test-file requires --approach tdd');
    process.exit(1);
  }
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
  const sessionDir = getSessionDir(args.session);
  const tasksDir = path.join(sessionDir, 'tasks');
  const taskFile = path.join(tasksDir, `${args.id}.json`);

  // Create tasks directory if needed
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

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

  // Write task JSON
  fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf-8');

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
