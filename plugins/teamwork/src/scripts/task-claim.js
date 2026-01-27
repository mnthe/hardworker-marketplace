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
 * Usage: task-claim.js --project <name> --team <name> --id <task_id> [--owner <owner_id>]
 */

const { parseArgs, generateHelp } = require('../lib/args.js');
const { claimTaskOptimistic } = require('../lib/optimistic-lock.js');
const { getTaskFile, updateSwarmWorkerOnClaim } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 */

/**
 * @typedef {Object} ParsedArgs
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [id]
 * @property {string} [owner]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--id': { key: 'id', aliases: ['-i', '--task', '--task-id'], required: true },
  '--owner': { key: 'owner', aliases: ['-o'] },
  '--role': { key: 'role', aliases: ['-r'] },
  '--strict-role': { key: 'strictRole', flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
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

  const taskFile = getTaskFile(args.project, args.team, args.id);

  // Retry configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 100;

  // Role enforcement options
  const claimOptions = {};
  if (args.role) {
    claimOptions.role = args.role;
  }
  if (args.strictRole) {
    claimOptions.strictRole = true;
  }

  // Attempt to claim with retry logic
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await claimTaskOptimistic(taskFile, owner, claimOptions);

    if (result.success) {
      // Success - output claimed task and exit
      console.log(`OK: Task ${args.id} claimed by ${owner}`);
      console.log(JSON.stringify(result.task, null, 2));

      // Update swarm worker state if this is a swarm worker
      // This tracks current_task, status, and last_heartbeat
      updateSwarmWorkerOnClaim(args.project, args.team, owner, args.id);

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

      case 'role_mismatch':
        console.error(`Error: Task ${args.id} role mismatch - task role: ${result.task_role}, worker role: ${result.worker_role}`);
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
