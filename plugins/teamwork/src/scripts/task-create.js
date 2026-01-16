#!/usr/bin/env bun
/**
 * task-create.js - Create new task JSON file
 * CLI to create task files with validation for teamwork projects
 *
 * Usage: task-create.js --project <name> --team <name> --id <id> --title "..." [options]
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');
const {
  getTaskFile,
  getTasksDir,
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
 * @property {string} [wave]
 */

const ARG_SPEC = {
  '--project': { key: 'project', alias: '-p', required: true },
  '--team': { key: 'team', alias: '-t', required: true },
  '--id': { key: 'id', alias: '-i', required: true },
  '--title': { key: 'title', required: true },
  '--description': { key: 'description', alias: '-d' },
  '--role': { key: 'role', alias: '-r', default: 'worker' },
  '--wave': { key: 'wave', alias: '-w' },
  '--help': { key: 'help', alias: '-h', flag: true }
};

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
    version: 0,
    created_at: now,
    updated_at: now,
    claimed_by: null,
    evidence: [],
  };

  // Add wave field if provided
  if (args.wave) {
    task.wave = args.wave;
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
    // Check for help flag first
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(generateHelp('task-create.js', ARG_SPEC, 'Create a new task for a teamwork project'));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);
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
