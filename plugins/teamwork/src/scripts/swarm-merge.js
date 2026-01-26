#!/usr/bin/env bun
/**
 * Swarm Merge Script
 * Merges all worker worktree branches to main when a wave completes.
 * Handles conflicts gracefully by aborting and returning detailed error information.
 *
 * Usage: swarm-merge.js --project <name> --team <name> --wave <n> --source-dir <path>
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
 * @property {number} wave - Wave number to merge
 * @property {string} sourceDir - Git repository path
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--wave': { key: 'wave', aliases: ['-w'], required: true },
  '--source-dir': { key: 'sourceDir', aliases: ['-s'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Swarm State Management
// ============================================================================

/**
 * Get swarm.json file path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Swarm file path
 */
function getSwarmFile(project, team) {
  const projectDir = getProjectDir(project, team);
  return path.join(projectDir, 'swarm', 'swarm.json');
}

/**
 * Read swarm.json
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Object} Swarm data
 */
function readSwarmFile(project, team) {
  const swarmFile = getSwarmFile(project, team);

  if (!fs.existsSync(swarmFile)) {
    throw new Error('Swarm not initialized. Run swarm-spawn first.');
  }

  try {
    const content = fs.readFileSync(swarmFile, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read swarm.json: ${error.message}`);
  }
}

/**
 * Update swarm.json
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {Object} updates - Fields to update
 * @returns {void}
 */
function updateSwarmFile(project, team, updates) {
  const swarmFile = getSwarmFile(project, team);
  const swarmData = readSwarmFile(project, team);

  Object.assign(swarmData, updates);

  fs.writeFileSync(swarmFile, JSON.stringify(swarmData, null, 2), 'utf-8');
}

/**
 * Read worker state file
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} workerId - Worker ID
 * @returns {Object} Worker data
 */
function readWorkerFile(project, team, workerId) {
  const projectDir = getProjectDir(project, team);
  const workerFile = path.join(projectDir, 'swarm', 'workers', `${workerId}.json`);

  if (!fs.existsSync(workerFile)) {
    throw new Error(`Worker file not found: ${workerId}`);
  }

  try {
    const content = fs.readFileSync(workerFile, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read worker file ${workerId}: ${error.message}`);
  }
}

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Check if working directory is clean
 * @param {string} dir - Git repository directory
 * @returns {{clean: boolean, error?: string}} Result
 */
function isWorkingDirectoryClean(dir) {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: dir,
    encoding: 'utf-8'
  });

  if (result.status !== 0) {
    return {
      clean: false,
      error: result.stderr || 'Failed to check git status'
    };
  }

  const output = result.stdout.trim();
  return { clean: output === '' };
}

/**
 * Get current branch name
 * @param {string} dir - Git repository directory
 * @returns {string} Branch name
 */
function getCurrentBranch(dir) {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: dir,
    encoding: 'utf-8'
  });

  if (result.status !== 0) {
    throw new Error('Failed to get current branch');
  }

  return result.stdout.trim();
}

/**
 * Checkout a branch
 * @param {string} dir - Git repository directory
 * @param {string} branch - Branch name
 * @returns {{success: boolean, error?: string}} Result
 */
function checkoutBranch(dir, branch) {
  const result = spawnSync('git', ['checkout', branch], {
    cwd: dir,
    encoding: 'utf-8'
  });

  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr || result.stdout || `Failed to checkout ${branch}`
    };
  }

  return { success: true };
}

/**
 * Merge a branch
 * @param {string} dir - Git repository directory
 * @param {string} branch - Branch name to merge
 * @returns {{success: boolean, conflictFiles?: string[], error?: string}} Result
 */
function mergeBranch(dir, branch) {
  const result = spawnSync('git', ['merge', branch, '--no-edit'], {
    cwd: dir,
    encoding: 'utf-8'
  });

  if (result.status === 0) {
    return { success: true };
  }

  // Check if merge conflict occurred by looking for unmerged files
  // This is more reliable than parsing localized git output messages
  const conflictFiles = getConflictedFiles(dir);

  if (conflictFiles.length > 0) {
    return {
      success: false,
      conflictFiles,
      error: `Merge conflict in ${conflictFiles.length} file(s)`
    };
  }

  // Non-conflict error (e.g., branch not found, other git error)
  return {
    success: false,
    error: result.stderr || result.stdout || 'Merge failed'
  };
}

/**
 * Get list of conflicted files
 * @param {string} dir - Git repository directory
 * @returns {string[]} Array of conflicted file paths
 */
function getConflictedFiles(dir) {
  // Use git ls-files --unmerged to find files with merge conflicts
  // This directly queries the index for unmerged entries, which is more reliable
  // than parsing git status output during merge conflicts
  const result = spawnSync('git', ['ls-files', '--unmerged'], {
    cwd: dir,
    encoding: 'utf-8'
  });

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  // Output format: <mode> <object> <stage>\t<file>
  // Example: 100644 abc123 1	file.txt
  // Stage 1 = common ancestor, 2 = ours, 3 = theirs
  // Each conflicted file appears multiple times (once per stage)
  const conflictedFiles = new Set();
  const lines = result.stdout.trim().split('\n');

  for (const line of lines) {
    if (!line) continue;
    const tabIndex = line.indexOf('\t');
    if (tabIndex > -1) {
      const filePath = line.substring(tabIndex + 1);
      if (filePath) {
        conflictedFiles.add(filePath);
      }
    }
  }

  return [...conflictedFiles];
}

/**
 * Abort merge
 * @param {string} dir - Git repository directory
 * @returns {void}
 */
function abortMerge(dir) {
  spawnSync('git', ['merge', '--abort'], {
    cwd: dir,
    encoding: 'utf-8'
  });
}

/**
 * Rebase a worktree to main
 * @param {string} worktreePath - Worktree directory path
 * @returns {{success: boolean, error?: string}} Result
 */
function rebaseWorktree(worktreePath) {
  const result = spawnSync('git', ['rebase', 'main'], {
    cwd: worktreePath,
    encoding: 'utf-8'
  });

  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr || result.stdout || 'Rebase failed'
    };
  }

  return { success: true };
}

// ============================================================================
// Merge Orchestration
// ============================================================================

/**
 * Merge all worker worktrees to main
 * @param {CliArgs} args - CLI arguments
 * @returns {Object} Merge result
 */
function mergeWorktrees(args) {
  const { project, team, wave, sourceDir } = args;

  // Validate source directory
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  // Check working directory is clean
  const cleanCheck = isWorkingDirectoryClean(sourceDir);
  if (!cleanCheck.clean) {
    throw new Error(`Working directory has uncommitted changes: ${cleanCheck.error || 'Uncommitted changes detected'}`);
  }

  // Read swarm state
  const swarmData = readSwarmFile(project, team);

  if (!swarmData.use_worktree) {
    throw new Error('Worktree mode is not enabled for this swarm');
  }

  if (swarmData.workers.length === 0) {
    throw new Error('No workers found in swarm');
  }

  // Get current branch (should be main)
  const currentBranch = getCurrentBranch(sourceDir);
  if (currentBranch !== 'main') {
    // Try to checkout main
    const checkoutResult = checkoutBranch(sourceDir, 'main');
    if (!checkoutResult.success) {
      throw new Error(`Not on main branch and failed to checkout: ${checkoutResult.error}`);
    }
  }

  // Merge each worker branch sequentially
  const merged = [];
  const notMerged = [];
  let conflictInfo = null;

  for (const workerId of swarmData.workers) {
    const workerData = readWorkerFile(project, team, workerId);
    const branchName = workerData.branch;

    if (!branchName) {
      notMerged.push(workerId);
      continue;
    }

    // Attempt merge
    const mergeResult = mergeBranch(sourceDir, branchName);

    if (mergeResult.success) {
      merged.push(workerId);
    } else {
      // Conflict or error occurred
      abortMerge(sourceDir);

      conflictInfo = {
        workerId,
        conflictFiles: mergeResult.conflictFiles || [],
        error: mergeResult.error
      };

      // Mark remaining workers as not merged
      notMerged.push(workerId);
      const remainingWorkers = swarmData.workers.slice(swarmData.workers.indexOf(workerId) + 1);
      notMerged.push(...remainingWorkers);

      break;
    }
  }

  // If conflict occurred, update swarm state and return conflict result
  if (conflictInfo) {
    updateSwarmFile(project, team, { paused: true });

    return {
      status: 'conflict',
      wave,
      conflict_at: conflictInfo.workerId,
      conflict_files: conflictInfo.conflictFiles,
      merged_before_conflict: merged,
      not_merged: notMerged
    };
  }

  // All merges successful - now rebase each worktree
  const rebased = [];
  const rebaseErrors = [];

  for (const workerId of swarmData.workers) {
    const workerData = readWorkerFile(project, team, workerId);
    const worktreePath = workerData.worktree;

    if (!worktreePath || !fs.existsSync(worktreePath)) {
      rebaseErrors.push({ workerId, error: 'Worktree path not found' });
      continue;
    }

    const rebaseResult = rebaseWorktree(worktreePath);

    if (rebaseResult.success) {
      rebased.push(workerId);
    } else {
      rebaseErrors.push({ workerId, error: rebaseResult.error });
    }
  }

  // Return success result
  return {
    status: 'success',
    wave,
    merged,
    rebased,
    rebase_errors: rebaseErrors.length > 0 ? rebaseErrors : undefined
  };
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
        'swarm-merge.js',
        ARG_SPEC,
        'Merge all worker worktree branches to main when a wave completes'
      )
    );
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Parse wave number
  args.wave = parseInt(args.wave, 10);
  if (isNaN(args.wave) || args.wave < 1) {
    console.error('Error: --wave must be a positive integer');
    process.exit(1);
  }

  try {
    const result = mergeWorktrees(args);
    console.log(JSON.stringify(result, null, 2));

    // Exit with error code if conflict occurred
    if (result.status === 'conflict') {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
