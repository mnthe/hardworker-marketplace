#!/usr/bin/env bun
/**
 * swarm-sync.js - Sync worker worktree with main branch
 * Rebases the worker's worktree branch onto main, handling conflicts
 *
 * Usage: swarm-sync.js --project <name> --team <name> --worker-id <id>
 */

const { spawnSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getWorkerState } = require('../lib/swarm-state.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} project
 * @property {string} team
 * @property {string} workerId - Worker ID
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--worker-id': { key: 'workerId', aliases: ['-w'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Rebase worktree onto main branch
 * @param {string} worktreePath - Path to worktree directory
 * @returns {{success: boolean, error?: string}} Result
 */
function rebaseWorktree(worktreePath) {
  // Run git rebase main
  const rebaseResult = spawnSync('git', ['rebase', 'main'], {
    cwd: worktreePath,
    encoding: 'utf-8'
  });

  if (rebaseResult.status !== 0) {
    // Rebase failed, abort it
    spawnSync('git', ['rebase', '--abort'], {
      cwd: worktreePath,
      encoding: 'utf-8'
    });

    return {
      success: false,
      error: 'Rebase failed due to conflicts'
    };
  }

  return { success: true };
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Sync worker worktree with main branch
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function syncWorktree(args) {
  // Get worker state
  let workerState;
  try {
    workerState = getWorkerState(args.project, args.team, args.workerId);
  } catch (error) {
    throw new Error(`Worker not found: ${args.workerId}`);
  }

  const worktreePath = workerState.worktree;

  if (!worktreePath) {
    throw new Error(`Worker ${args.workerId} does not have a worktree`);
  }

  // Rebase worktree
  const result = rebaseWorktree(worktreePath);

  if (!result.success) {
    // Return conflict status
    console.log(JSON.stringify({
      status: 'conflict',
      worker_id: args.workerId,
      error: result.error
    }, null, 2));
    return;
  }

  // Return success status
  console.log(JSON.stringify({
    status: 'success',
    worker_id: args.workerId,
    worktree: worktreePath
  }, null, 2));
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
      console.log(generateHelp(
        'swarm-sync.js',
        ARG_SPEC,
        'Sync worker worktree with main branch using git rebase'
      ));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

    // Sync worktree
    syncWorktree(args);

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

module.exports = {
  rebaseWorktree,
  syncWorktree
};
