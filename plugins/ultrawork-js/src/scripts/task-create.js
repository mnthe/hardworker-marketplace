#!/usr/bin/env node
/**
 * task-create.js - Create new task JSON file
 * CLI to create task files with validation
 *
 * Usage: task-create.js --session <ID> --id <id> --subject "..." [options]
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir } = require('../lib/session-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').Complexity} Complexity
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
 */

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {CliArgs} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {CliArgs} */
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--session':
        args.session = argv[++i];
        break;
      case '--id':
        args.id = argv[++i];
        break;
      case '--subject':
        args.subject = argv[++i];
        break;
      case '--description':
        args.description = argv[++i];
        break;
      case '--complexity':
        args.complexity = /** @type {Complexity} */ (argv[++i]);
        break;
      case '--criteria':
        args.criteria = argv[++i];
        break;
      case '--blocked-by':
        args.blockedBy = argv[++i];
        break;
      case '-h':
      case '--help':
        console.log('Usage: task-create.js --session <ID> --id <id> --subject "..." [options]');
        console.log('Options:');
        console.log('  --description "..."       Task description (defaults to subject)');
        console.log('  --complexity simple|standard|complex  (default: standard)');
        console.log('  --criteria "..."          Pipe-separated criteria');
        console.log('  --blocked-by "1,2"        Comma-separated task IDs');
        process.exit(0);
        break;
    }
  }

  return args;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate CLI arguments
 * @param {CliArgs} args - Arguments to validate
 * @returns {void}
 */
function validateArgs(args) {
  if (!args.session) {
    console.error('Error: --session required');
    process.exit(1);
  }

  if (!args.id) {
    console.error('Error: --id required');
    process.exit(1);
  }

  if (!args.subject) {
    console.error('Error: --subject required');
    process.exit(1);
  }

  // Validate complexity if provided
  if (args.complexity) {
    /** @type {Complexity[]} */
    const validComplexities = ['simple', 'standard', 'complex'];
    if (!validComplexities.includes(args.complexity)) {
      console.error(`Error: Invalid complexity "${args.complexity}". Must be: simple, standard, or complex`);
      process.exit(1);
    }
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
    const args = parseArgs(process.argv.slice(2));
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
