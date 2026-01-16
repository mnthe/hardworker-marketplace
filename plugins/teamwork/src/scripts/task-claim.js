#!/usr/bin/env bun
/**
 * task-claim.js - Claim a teamwork task with optimistic concurrency control
 *
 * Implements optimistic locking with version checking:
 * 1. Read task and check if claimable (status=open, claimed_by=null)
 * 2. Attempt to claim with version check
 * 3. Retry on version conflict (up to 3 attempts)
 * 4. Fail if already claimed or not in valid status
 *
 * Backward compatible: tasks without version field are treated as version 0
 *
 * Usage: task-claim.js --dir <path> --id <task_id> [--owner <owner_id>]
 */

const path = require('path');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { claimTaskOptimistic } = require('../lib/optimistic-lock.js');

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

const ARG_SPEC = {
  '--dir': { key: 'dir', alias: '-d', required: true },
  '--id': { key: 'id', alias: '-i', required: true },
  '--owner': { key: 'owner', alias: '-o' },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Main execution function with retry logic for version conflicts
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('task-claim.js', ARG_SPEC, 'Atomically claim a task with optimistic concurrency control'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Default owner to CLAUDE_SESSION_ID or worker-PID
  const owner = args.owner || process.env.CLAUDE_SESSION_ID || `worker-${process.pid}`;

  const taskFile = path.join(args.dir, 'tasks', `${args.id}.json`);

  // Retry configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 100;

  // Attempt to claim with retry logic
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await claimTaskOptimistic(taskFile, owner);

    if (result.success) {
      // Success - output claimed task and exit
      console.log(`OK: Task ${args.id} claimed by ${owner}`);
      console.log(JSON.stringify(result.task, null, 2));
      process.exit(0);
    }

    // Handle different failure reasons
    switch (result.reason) {
      case 'task_not_found':
        console.error(`Error: Task ${args.id} not found`);
        process.exit(1);

      case 'already_claimed':
        console.error(`Error: Task ${args.id} already claimed by another worker`);
        process.exit(1);

      case 'not_claimable':
        console.error(`Error: Task ${args.id} is not in a claimable status`);
        process.exit(1);

      case 'version_conflict':
        // Retry on version conflict
        if (attempt < MAX_RETRIES) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
          continue;
        } else {
          // Max retries exceeded
          console.error(`Error: Task ${args.id} claim failed after ${MAX_RETRIES} attempts (version conflicts)`);
          process.exit(1);
        }

      default:
        console.error(`Error: Unknown failure reason: ${result.reason}`);
        process.exit(1);
    }
  }

  // Should never reach here
  console.error('Error: Unexpected execution path');
  process.exit(1);
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
