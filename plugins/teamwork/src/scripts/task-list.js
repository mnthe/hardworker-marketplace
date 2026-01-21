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
 * @property {string} [wave]
 * @property {boolean} [available]
 * @property {'json'|'table'} [format]
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--status': { key: 'status', aliases: ['-s'] },
  '--role': { key: 'role', aliases: ['-r'] },
  '--wave': { key: 'wave', aliases: ['-w'] },
  '--available': { key: 'available', aliases: ['-a'], flag: true },
  '--format': { key: 'format', aliases: ['-f'], default: 'table' },
  '--field': { key: 'field' },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Field Extraction
// ============================================================================

/**
 * Extract nested field from object using dot notation
 * Example: "status" or "evidence[0].type"
 * @param {any} obj - Object to query
 * @param {string} fieldPath - Dot-separated field path
 * @returns {any} Field value or undefined
 */
function getNestedField(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let current = obj;

  for (const part of parts) {
    // Handle array access: field[0]
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      const [, fieldName, index] = match;
      current = current[fieldName];
      if (!current || !Array.isArray(current)) {
        return undefined;
      }
      current = current[parseInt(index, 10)];
    } else {
      current = current[part];
    }

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
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

  // Wave filter
  if (args.wave && task.wave !== args.wave) {
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
  let hasWaveField = false;

  for (const taskId of taskIds) {
    try {
      const task = readTask(args.project, args.team, taskId);

      // Check if any task has wave field
      if (task.wave !== undefined) {
        hasWaveField = true;
      }

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
  if (args.field) {
    // Extract specific field from each task
    const values = tasks.map(task => {
      const value = getNestedField(task, args.field);
      return value !== undefined ? value : null;
    });

    // Output in requested format
    if (args.format === 'json') {
      console.log(JSON.stringify(values, null, 2));
    } else {
      // Table format: one value per line
      for (const value of values) {
        if (typeof value === 'string') {
          console.log(value);
        } else {
          console.log(JSON.stringify(value));
        }
      }
    }
  } else if (args.format === 'json') {
    console.log(JSON.stringify(tasks, null, 2));
  } else {
    // Table format
    if (hasWaveField) {
      console.log('ID|STATUS|ROLE|WAVE|TITLE|CLAIMED_BY');
      for (const task of tasks) {
        const claimedBy = task.claimed_by || '';
        const wave = task.wave || '';
        console.log(`${task.id}|${task.status}|${task.role}|${wave}|${task.title}|${claimedBy}`);
      }
    } else {
      console.log('ID|STATUS|ROLE|TITLE|CLAIMED_BY');
      for (const task of tasks) {
        const claimedBy = task.claimed_by || '';
        console.log(`${task.id}|${task.status}|${task.role}|${task.title}|${claimedBy}`);
      }
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
      console.log(generateHelp('task-list.js', ARG_SPEC, 'List tasks for a teamwork project with filtering options. Use --field to extract specific field from each task.'));
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
