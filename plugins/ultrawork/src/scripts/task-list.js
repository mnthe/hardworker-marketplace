#!/usr/bin/env bun
/**
 * task-list.js - List tasks with filtering
 * Usage: task-list.js --session <ID> [--status open|resolved] [--format json|table]
 *
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
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} [session]
 * @property {string} [status]
 * @property {'json' | 'table'} format
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--session': { key: 'session', alias: '-s', required: true },
  '--status': { key: 'status', alias: '-S' },
  '--format': { key: 'format', alias: '-f', default: 'table' },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Task Collection
// ============================================================================

/**
 * @typedef {Object} TaskSummary
 * @property {string} id
 * @property {string} status
 * @property {string} subject
 * @property {string} blocked_by
 * @property {string} complexity
 */

/**
 * Collect tasks from tasks directory
 * @param {string} tasksDir - Tasks directory path
 * @param {string} [statusFilter] - Optional status filter
 * @returns {TaskSummary[]} Array of task summaries
 */
function collectTasks(tasksDir, statusFilter) {
  if (!fs.existsSync(tasksDir)) {
    throw new Error('No tasks directory found');
  }

  /** @type {TaskSummary[]} */
  const tasks = [];
  const files = fs.readdirSync(tasksDir);

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const taskFile = path.join(tasksDir, file);
    const id = path.basename(file, '.json');

    try {
      const content = fs.readFileSync(taskFile, 'utf-8');
      const taskData = JSON.parse(content);

      const status = taskData.status || 'open';
      const subject = taskData.subject || 'Unknown';
      const blocked_by = (taskData.blockedBy || []).join(',');
      const complexity = taskData.complexity || 'standard';

      // Apply status filter
      if (statusFilter && status !== statusFilter) {
        continue;
      }

      tasks.push({
        id,
        status,
        subject,
        blocked_by,
        complexity,
      });
    } catch (err) {
      // Skip invalid task files
      console.error(`Warning: Failed to parse ${file}: ${err}`, { file: process.stderr });
      continue;
    }
  }

  return tasks;
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Output tasks in JSON format
 * @param {TaskSummary[]} tasks - Tasks to output
 * @returns {void}
 */
function outputJson(tasks) {
  const output = tasks.map((t) => ({
    id: t.id,
    status: t.status,
    subject: t.subject,
    blockedBy: t.blocked_by,
    complexity: t.complexity,
  }));

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Output tasks in table format
 * @param {TaskSummary[]} tasks - Tasks to output
 * @returns {void}
 */
function outputTable(tasks) {
  console.log('ID|STATUS|SUBJECT|BLOCKED_BY|COMPLEXITY');
  for (const task of tasks) {
    console.log(
      `${task.id}|${task.status}|${task.subject}|${task.blocked_by}|${task.complexity}`
    );
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('task-list.js', ARG_SPEC, 'List tasks with optional filtering by status and output format'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  try {
    // Get session directory
    const sessionDir = getSessionDir(args.session);
    const tasksDir = path.join(sessionDir, 'tasks');

    // Collect tasks
    const tasks = collectTasks(tasksDir, args.status);

    // Output in requested format
    if (args.format === 'json') {
      outputJson(tasks);
    } else {
      outputTable(tasks);
    }

    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }
}

// Run if invoked directly
if (require.main === module) {
  main();
}

module.exports = { collectTasks, outputJson, outputTable };
