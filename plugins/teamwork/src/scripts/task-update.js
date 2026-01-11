#!/usr/bin/env bun
/**
 * task-update.js - Update teamwork task
 *
 * Usage: task-update.js --dir <path> --id <task_id> [--status open|resolved] [--add-evidence "..."] [--owner <id>] [--release]
 */

const fs = require('fs');
const path = require('path');
const { acquireLock, releaseLock } = require('../lib/file-lock.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').TaskStatus} TaskStatus
 */

/**
 * @typedef {Object} ParsedArgs
 * @property {string} [dir]
 * @property {string} [id]
 * @property {TaskStatus} [status]
 * @property {string} [addEvidence]
 * @property {string} [owner]
 * @property {boolean} [release]
 * @property {boolean} [help]
 */

// ============================================================================
// Main Logic
// ============================================================================

const ARG_SPEC = {
  '--dir': { key: 'dir', alias: '-d', required: true },
  '--id': { key: 'id', alias: '-i', required: true },
  '--status': { key: 'status', alias: '-s' },
  '--add-evidence': { key: 'addEvidence', alias: '-e' },
  '--owner': { key: 'owner', alias: '-o' },
  '--release': { key: 'release', alias: '-r', flag: true },
  '--help': { key: 'help', alias: '-h', flag: true }
};

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('task-update.js', ARG_SPEC, 'Update teamwork task status, evidence, or ownership'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  try {
    // Get task file path
    const taskFile = path.join(args.dir, 'tasks', `${args.id}.json`);

    // Check if task exists
    if (!fs.existsSync(taskFile)) {
      console.error(`Error: Task ${args.id} not found`);
      process.exit(1);
    }

    // Acquire lock
    const acquired = await acquireLock(taskFile);
    if (!acquired) {
      console.error(`Error: Failed to acquire lock for task ${args.id}`);
      process.exit(1);
    }

    try {
      // Read current task
      const content = fs.readFileSync(taskFile, 'utf-8');
      /** @type {Task} */
      const task = JSON.parse(content);

      // Update status if provided
      if (args.status) {
        task.status = args.status;

        // Set completed_at when marking as resolved
        if (args.status === 'resolved') {
          task.completed_at = new Date().toISOString();
        }
      }

      // Add evidence if provided
      if (args.addEvidence) {
        task.evidence.push(args.addEvidence);
      }

      // Update owner if provided
      if (args.owner !== undefined) {
        task.claimed_by = args.owner;
      }

      // Release task if requested
      if (args.release) {
        task.claimed_by = null;
        if (task.claimed_at !== undefined) {
          task.claimed_at = null;
        }
      }

      // Update timestamp
      task.updated_at = new Date().toISOString();

      // Write back atomically
      const tmpFile = `${taskFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(task, null, 2), 'utf-8');
      fs.renameSync(tmpFile, taskFile);

      // Output success message and updated task
      console.log(`OK: Task ${args.id} updated`);
      console.log(JSON.stringify(task, null, 2));
    } finally {
      releaseLock(taskFile);
    }
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
