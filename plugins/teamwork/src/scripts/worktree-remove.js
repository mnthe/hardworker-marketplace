#!/usr/bin/env bun
/**
 * Worktree Remove Script
 * Removes a git worktree and its associated branch for a worker.
 *
 * Usage: worktree-remove.js --project <name> --team <name> --worker-id <id> --source-dir <path>
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir } = require('../lib/project-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} project
 * @property {string} team
 * @property {string} workerId - Worker ID (e.g., 'w1')
 * @property {string} sourceDir - Source git repository directory
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--worker-id': { key: 'workerId', aliases: ['-w'], required: true },
  '--source-dir': { key: 'sourceDir', aliases: ['-s'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Git Helper Functions
// ============================================================================

/**
 * Check if a directory is a git repository
 * @param {string} dir - Directory path
 * @returns {boolean} True if directory is a git repository
 */
function isGitRepository(dir) {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd: dir,
    encoding: 'utf-8'
  });

  return result.status === 0;
}

/**
 * Remove a git worktree
 * @param {string} sourceDir - Source repository directory
 * @param {string} worktreePath - Path of the worktree to remove
 * @returns {{success: boolean, error?: string}} Result
 */
function removeWorktree(sourceDir, worktreePath) {
  // Check if worktree exists
  if (!fs.existsSync(worktreePath)) {
    // Worktree already removed (idempotent)
    return { success: true };
  }

  // Remove worktree using git
  const result = spawnSync(
    'git',
    ['worktree', 'remove', '--force', worktreePath],
    {
      cwd: sourceDir,
      encoding: 'utf-8'
    }
  );

  if (result.status !== 0) {
    // If git worktree remove failed, try manual cleanup
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove worktree: ${result.stderr || error.message}`
      };
    }
  }

  return { success: true };
}

/**
 * Delete a git branch
 * @param {string} sourceDir - Source repository directory
 * @param {string} branchName - Branch name to delete
 * @returns {{success: boolean, error?: string}} Result
 */
function deleteBranch(sourceDir, branchName) {
  // Check if branch exists
  const checkResult = spawnSync(
    'git',
    ['branch', '--list', branchName],
    {
      cwd: sourceDir,
      encoding: 'utf-8'
    }
  );

  if (!checkResult.stdout.trim()) {
    // Branch doesn't exist (already deleted or never created)
    return { success: true };
  }

  // Delete branch
  const result = spawnSync(
    'git',
    ['branch', '-D', branchName],
    {
      cwd: sourceDir,
      encoding: 'utf-8'
    }
  );

  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr || result.stdout || 'Failed to delete branch'
    };
  }

  return { success: true };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(
      generateHelp(
        'worktree-remove.js',
        ARG_SPEC,
        'Remove a git worktree and its associated branch for a worker'
      )
    );
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Validate source directory
  if (!fs.existsSync(args.sourceDir)) {
    console.error(`Error: Source directory does not exist: ${args.sourceDir}`);
    process.exit(1);
  }

  // Check if source directory is a git repository
  if (!isGitRepository(args.sourceDir)) {
    console.error(`Error: Source directory is not a git repository: ${args.sourceDir}`);
    process.exit(1);
  }

  // Get worktree path
  const projectDir = getProjectDir(args.project, args.team);
  const worktreesDir = path.join(projectDir, 'worktrees');
  const worktreePath = path.join(worktreesDir, args.workerId);
  const branchName = `worker-${args.workerId}`;

  // Remove worktree
  const removeResult = removeWorktree(args.sourceDir, worktreePath);
  if (!removeResult.success) {
    console.error(`Error: ${removeResult.error}`);
    process.exit(1);
  }

  // Delete branch
  const deleteResult = deleteBranch(args.sourceDir, branchName);
  if (!deleteResult.success) {
    console.error(`Error: ${deleteResult.error}`);
    process.exit(1);
  }

  // Output success
  console.log('OK: Worktree and branch removed');
  console.log(
    JSON.stringify(
      {
        status: 'success',
        removed: worktreePath
      },
      null,
      2
    )
  );
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
