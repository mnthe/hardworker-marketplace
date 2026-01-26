#!/usr/bin/env bun
/**
 * Worktree Create Script
 * Creates a git worktree for a worker in the teamwork project.
 *
 * Usage: worktree-create.js --project <name> --team <name> --worker-id <id> --source-dir <path>
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
 * Create a git worktree
 * @param {string} sourceDir - Source repository directory
 * @param {string} worktreePath - Path for the new worktree
 * @param {string} branchName - Branch name for the worktree
 * @returns {{success: boolean, error?: string}} Result
 */
function createWorktree(sourceDir, worktreePath, branchName) {
  // Create parent directory if it doesn't exist
  const parentDir = path.dirname(worktreePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Create worktree with new branch
  const result = spawnSync(
    'git',
    ['worktree', 'add', '-b', branchName, worktreePath],
    {
      cwd: sourceDir,
      encoding: 'utf-8'
    }
  );

  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr || result.stdout || 'Failed to create worktree'
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
        'worktree-create.js',
        ARG_SPEC,
        'Create a git worktree for a worker in the teamwork project'
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

  // Create worktree
  const result = createWorktree(args.sourceDir, worktreePath, branchName);

  if (!result.success) {
    console.error(`Error: Failed to create worktree: ${result.error}`);
    process.exit(1);
  }

  // Output success
  console.log('OK: Worktree created');
  console.log(
    JSON.stringify(
      {
        status: 'success',
        worktree: worktreePath,
        branch: branchName
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
