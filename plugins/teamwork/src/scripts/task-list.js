#!/usr/bin/env bun
/**
 * task-list.js - List tasks with filtering
 * CLI to list and filter tasks in a teamwork project
 *
 * Usage: task-list.js --project <name> --team <name> [--status open|resolved] [--role <role>] [--available] [--format json|table]
 */

const fs = require('fs');
const { getTasksDir, listTaskIds, readTask } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').TaskStatus} TaskStatus
 * @typedef {import('../lib/types.js').Role} Role
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} [project]
 * @property {string} [team]
 * @property {TaskStatus} [status]
 * @property {Role} [role]
 * @property {boolean} [available]
 * @property {'json'|'table'} [format]
 */

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {CliArgs} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {CliArgs} */
  const args = {
    available: false,
    format: 'table',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--project':
        args.project = argv[++i];
        break;
      case '--team':
        args.team = argv[++i];
        break;
      case '--status':
        args.status = /** @type {TaskStatus} */ (argv[++i]);
        break;
      case '--role':
        args.role = /** @type {Role} */ (argv[++i]);
        break;
      case '--available':
        args.available = true;
        break;
      case '--format':
        args.format = /** @type {'json'|'table'} */ (argv[++i]);
        break;
      case '-h':
      case '--help':
        console.log('Usage: task-list.js --project <name> --team <name> [options]');
        console.log('Options:');
        console.log('  --status open|in_progress|resolved  Filter by status');
        console.log('  --role <role>                       Filter by role');
        console.log('  --available                         Show only available tasks (open, unclaimed)');
        console.log('  --format json|table                 Output format (default: table)');
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
}

// ============================================================================
// Task Filtering
// ============================================================================

/**
 * Check if task matches filters
 * @param {Task} task - Task to check
 * @param {CliArgs} args - Filter arguments
 * @returns {boolean} True if task matches filters
 */
function matchesFilters(task, args) {
  // Status filter
  if (args.status && task.status !== args.status) {
    return false;
  }

  // Role filter
  if (args.role && task.role !== args.role) {
    return false;
  }

  // Available filter: open, unclaimed
  if (args.available) {
    if (task.status !== 'open' || task.claimed_by !== null) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Task Listing
// ============================================================================

/**
 * List tasks with filtering
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function listTasks(args) {
  const tasksDir = getTasksDir(args.project, args.team);

  if (!fs.existsSync(tasksDir)) {
    console.error('No tasks directory found');
    process.exit(1);
  }

  // Collect tasks
  const taskIds = listTaskIds(args.project, args.team);
  const tasks = [];

  for (const taskId of taskIds) {
    try {
      const task = readTask(args.project, args.team, taskId);

      // Apply filters
      if (matchesFilters(task, args)) {
        tasks.push(task);
      }
    } catch {
      // Skip invalid task files
      continue;
    }
  }

  // Output
  if (args.format === 'json') {
    console.log(JSON.stringify(tasks, null, 2));
  } else {
    // Table format
    console.log('ID|STATUS|ROLE|TITLE|CLAIMED_BY');
    for (const task of tasks) {
      const claimedBy = task.claimed_by || '';
      console.log(`${task.id}|${task.status}|${task.role}|${task.title}|${claimedBy}`);
    }
  }
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
    listTasks(args);
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
