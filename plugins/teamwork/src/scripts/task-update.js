#!/usr/bin/env bun
/**
 * task-update.js - Update teamwork task
 *
 * Usage: task-update.js --dir <path> --id <task_id> [--status open|resolved] [--add-evidence "..."] [--owner <id>] [--release]
 */

const fs = require('fs');
const path = require('path');
const { acquireLock, releaseLock } = require('../lib/file-lock.js');

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

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {ParsedArgs} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {ParsedArgs} */
  const args = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--dir':
        args.dir = next;
        i++;
        break;
      case '--id':
        args.id = next;
        i++;
        break;
      case '--status':
        args.status = /** @type {TaskStatus} */ (next);
        i++;
        break;
      case '--add-evidence':
        args.addEvidence = next;
        i++;
        break;
      case '--owner':
        args.owner = next;
        i++;
        break;
      case '--release':
        args.release = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
    }
  }

  return args;
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  const args = parseArgs(process.argv);

  // Handle help
  if (args.help) {
    console.log('Usage: task-update.js --dir <path> --id <task_id> [--status open|resolved] [--add-evidence "..."] [--owner <id>] [--release]');
    process.exit(0);
  }

  // Validate required arguments
  if (!args.dir || !args.id) {
    console.error('Error: --dir and --id required');
    process.exit(1);
  }

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
