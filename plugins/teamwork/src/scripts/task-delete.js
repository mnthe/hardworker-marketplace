#!/usr/bin/env bun
/**
 * task-delete.js - Delete teamwork task
 *
 * Usage: task-delete.js --project <name> --team <name> --id <task_id> [--force]
 *
 * PLANNING phase only - prevents deletion after EXECUTION phase started
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getTaskFile, getTasksDir, readProject, listTasks } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').Project} Project
 */

/**
 * @typedef {Object} ParsedArgs
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [id]
 * @property {boolean} [force]
 * @property {boolean} [help]
 */

// ============================================================================
// Main Logic
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--id': { key: 'id', aliases: ['-i', '--task', '--task-id'], required: true },
  '--force': { key: 'force', aliases: ['-f'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('task-delete.js', ARG_SPEC, 'Delete a task (PLANNING phase only)'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  try {
    // Get task file path
    const taskFile = getTaskFile(args.project, args.team, args.id);

    // Check if task exists
    if (!fs.existsSync(taskFile)) {
      console.error(`Error: Task ${args.id} not found`);
      process.exit(1);
    }

    // Read task to check status
    const content = fs.readFileSync(taskFile, 'utf-8');
    /** @type {Task} */
    const task = JSON.parse(content);

    // Check phase constraint: Only allow deletion in PLANNING phase
    // If task is in_progress or resolved, it means EXECUTION has started
    if (task.status !== 'open') {
      console.error(`Error: Cannot delete task after EXECUTION phase started. Task status: ${task.status}. Add a new task instead.`);
      process.exit(1);
    }

    // Check for dependent tasks (tasks that are blocked by this one)
    const allTasks = listTasks(args.project, args.team);
    const dependentTasks = allTasks.filter(t =>
      t.blocked_by && t.blocked_by.includes(args.id)
    );

    if (dependentTasks.length > 0 && !args.force) {
      const dependentIds = dependentTasks.map(t => t.id).join(', ');
      console.error(`WARNING: Task ${dependentIds} depend on Task ${args.id}. Use --force to delete.`);
      process.exit(1);
    }

    // Delete task file
    fs.unlinkSync(taskFile);

    // Output success message
    if (dependentTasks.length > 0) {
      console.log(`OK: Task ${args.id} deleted (dependencies orphaned)`);
    } else {
      console.log(`OK: Task ${args.id} deleted`);
    }

    console.log(JSON.stringify({
      status: 'deleted',
      id: args.id,
      orphaned_dependencies: dependentTasks.map(t => t.id)
    }, null, 2));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Unknown error occurred');
    }
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
