#!/usr/bin/env node
/**
 * task-create.js - Create new task JSON file
 * CLI to create task files with validation for teamwork projects
 *
 * Usage: task-create.js --project <name> --team <name> --id <id> --title "..." [options]
 */

const fs = require('fs');
const {
  getProjectDir,
  getTaskFile,
  getTasksDir,
  writeTask,
} = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').Role} Role
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [id]
 * @property {string} [title]
 * @property {string} [description]
 * @property {Role} [role]
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
      case '--project':
        args.project = argv[++i];
        break;
      case '--team':
        args.team = argv[++i];
        break;
      case '--id':
        args.id = argv[++i];
        break;
      case '--title':
        args.title = argv[++i];
        break;
      case '--description':
        args.description = argv[++i];
        break;
      case '--role':
        args.role = /** @type {Role} */ (argv[++i]);
        break;
      case '-h':
      case '--help':
        console.log('Usage: task-create.js --project <name> --team <name> --id <id> --title "..." [options]');
        console.log('Options:');
        console.log('  --description "..."       Task description (defaults to title)');
        console.log('  --role <role>            Worker role: frontend|backend|devops|test|docs|security|review|worker (default: worker)');
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
  if (!args.project) {
    console.error('Error: --project required');
    process.exit(1);
  }

  if (!args.team) {
    console.error('Error: --team required');
    process.exit(1);
  }

  if (!args.id) {
    console.error('Error: --id required');
    process.exit(1);
  }

  if (!args.title) {
    console.error('Error: --title required');
    process.exit(1);
  }

  // Validate role if provided
  if (args.role) {
    /** @type {Role[]} */
    const validRoles = ['frontend', 'backend', 'devops', 'test', 'docs', 'security', 'review', 'worker'];
    if (!validRoles.includes(args.role)) {
      console.error(`Error: Invalid role "${args.role}". Must be one of: ${validRoles.join(', ')}`);
      process.exit(1);
    }
  }
}

// ============================================================================
// Task Creation
// ============================================================================

/**
 * Create task file
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function createTask(args) {
  const tasksDir = getTasksDir(args.project, args.team);
  const taskFile = getTaskFile(args.project, args.team, args.id);

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
    title: args.title,
    description: args.description || args.title,
    role: args.role || 'worker',
    status: 'open',
    created_at: now,
    updated_at: now,
    claimed_by: null,
    evidence: [],
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
