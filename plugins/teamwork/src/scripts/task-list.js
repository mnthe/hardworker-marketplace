#!/usr/bin/env bun
/**
 * task-list.js - List tasks with filtering
 * CLI to list and filter tasks in a teamwork project
 *
 * Usage: task-list.js --project <name> --team <name> [--status open|resolved] [--role <role>] [--available] [--format json|table]
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');
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

const ARG_SPEC = {
  '--project': { key: 'project', alias: '-p', required: true },
  '--team': { key: 'team', alias: '-t', required: true },
  '--status': { key: 'status', alias: '-s' },
  '--role': { key: 'role', alias: '-r' },
  '--available': { key: 'available', alias: '-a', flag: true },
  '--format': { key: 'format', alias: '-f', default: 'table' },
  '--help': { key: 'help', alias: '-h', flag: true }
};

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
    // Check for help flag first
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(generateHelp('task-list.js', ARG_SPEC, 'List tasks for a teamwork project with filtering options'));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

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
