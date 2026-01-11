#!/usr/bin/env bun
/**
 * task-claim.js - Claim a teamwork task with atomic locking
 *
 * Implements claim-verify pattern:
 * 1. Acquire file lock
 * 2. Read task and check if claimable (status=open, claimed_by=null)
 * 3. Write claim (update claimed_by)
 * 4. Re-read to verify claim succeeded
 * 5. Release lock
 *
 * Usage: task-claim.js --dir <path> --id <task_id> [--owner <owner_id>]
 */

const fs = require('fs');
const path = require('path');
const { withLock } = require('../lib/file-lock.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 */

/**
 * @typedef {Object} ParsedArgs
 * @property {string} [dir]
 * @property {string} [id]
 * @property {string} [owner]
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
      case '--owner':
        args.owner = next;
        i++;
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
    console.log('Usage: task-claim.js --dir <path> --id <task_id> [--owner <owner_id>]');
    process.exit(0);
  }

  // Validate required arguments
  if (!args.dir || !args.id) {
    console.error('Error: --dir and --id required');
    process.exit(1);
  }

  // Default owner to CLAUDE_SESSION_ID or worker-PID
  const owner = args.owner || process.env.CLAUDE_SESSION_ID || `worker-${process.pid}`;

  const taskFile = path.join(args.dir, 'tasks', `${args.id}.json`);

  // Check if task file exists
  if (!fs.existsSync(taskFile)) {
    console.error(`Error: Task ${args.id} not found`);
    process.exit(1);
  }

  try {
    // Perform atomic claim with file lock
    const claimedTask = await withLock(taskFile, async () => {
      // Step 1: Read current task
      const content = fs.readFileSync(taskFile, 'utf-8');
      /** @type {Task} */
      const task = JSON.parse(content);

      // Step 2: Check if task is claimable
      const currentStatus = task.status || 'open';
      const currentOwner = task.claimed_by;

      if (currentStatus !== 'open') {
        throw new Error(`Task ${args.id} is not open (status: ${currentStatus})`);
      }

      if (currentOwner !== null && currentOwner !== undefined && currentOwner !== '') {
        throw new Error(`Task ${args.id} already claimed by ${currentOwner}`);
      }

      // Step 3: Claim the task
      task.claimed_by = owner;
      task.updated_at = new Date().toISOString();

      // Write atomically using temp file + rename
      const tmpFile = `${taskFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(task, null, 2), 'utf-8');
      fs.renameSync(tmpFile, taskFile);

      // Step 4: Verify claim succeeded (re-read and check)
      const verifyContent = fs.readFileSync(taskFile, 'utf-8');
      /** @type {Task} */
      const verifiedTask = JSON.parse(verifyContent);

      if (verifiedTask.claimed_by !== owner) {
        throw new Error(`Claim verification failed: expected owner=${owner}, got owner=${verifiedTask.claimed_by}`);
      }

      return verifiedTask;
    });

    // Output success message and task
    console.log(`OK: Task ${args.id} claimed by ${owner}`);
    console.log(JSON.stringify(claimedTask, null, 2));
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
