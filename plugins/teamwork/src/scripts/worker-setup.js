#!/usr/bin/env bun
/**
 * Teamwork Worker Setup Script
 * Prepares worker environment and validates project exists
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');
const {
  getProjectDir,
  getTasksDir,
  projectExists,
} = require('../lib/project-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').Role} Role
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} project
 * @property {string} team
 * @property {Role | null} role
 * @property {boolean} loop
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--project': { key: 'project', alias: '-p' },
  '--team': { key: 'team', alias: '-t' },
  '--role': { key: 'role', alias: '-r' },
  '--loop': { key: 'loop', alias: '-l', flag: true },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Git Detection
// ============================================================================

/**
 * Detect project name from git repository
 * @returns {string} Project name or 'unknown'
 */
function detectProjectName() {
  try {
    const toplevel = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return path.basename(toplevel);
  } catch {
    return 'unknown';
  }
}

/**
 * Detect team name from git branch
 * @returns {string} Team name (normalized) or 'main'
 */
function detectTeamName() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    // Normalize branch name (replace / with -)
    return branch.replace(/\//g, '-');
  } catch {
    return 'main';
  }
}

// ============================================================================
// Task Counting
// ============================================================================

/**
 * Count tasks by status with optional role filter
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {Role | null} roleFilter - Optional role filter
 * @returns {{ total: number, open: number }} Task counts
 */
function countTasks(project, team, roleFilter) {
  const tasksDir = getTasksDir(project, team);

  if (!fs.existsSync(tasksDir)) {
    return { total: 0, open: 0 };
  }

  let total = 0;
  let open = 0;

  const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const taskFile = path.join(tasksDir, file);
    try {
      const content = fs.readFileSync(taskFile, 'utf-8');
      const task = JSON.parse(content);

      // Apply role filter if specified
      if (roleFilter && task.role !== roleFilter) {
        continue;
      }

      total++;

      // Count as open if status is "open" and not claimed
      if (task.status === 'open' && (!task.claimed_by || task.claimed_by === null)) {
        open++;
      }
    } catch {
      // Skip invalid task files
      continue;
    }
  }

  return { total, open };
}

// ============================================================================
// Main Setup Logic
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('worker-setup.js', ARG_SPEC, 'Prepare teamwork worker environment and validate project exists'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Detect or use override for project name
  const project = args.project || detectProjectName();

  // Detect or use override for team name
  const team = args.team || detectTeamName();

  // Check if project exists
  if (!projectExists(project, team)) {
    const teamworkDir = getProjectDir(project, team);
    console.error('❌ Error: No teamwork project found');
    console.error('');
    console.error(`   Project: ${project}`);
    console.error(`   Sub-team: ${team}`);
    console.error(`   Expected at: ${teamworkDir}`);
    console.error('');
    console.error('   Start a project first:');
    console.error('     /teamwork "your goal here"');
    console.error('');
    process.exit(1);
  }

  // Count tasks
  const { total, open } = countTasks(project, team, args.role);

  // Build output
  const teamworkDir = getProjectDir(project, team);
  const roleDisplay = args.role || 'any';

  console.log(`\
═══════════════════════════════════════════════════════════
 TEAMWORK WORKER READY
═══════════════════════════════════════════════════════════

 Project: ${project}
 Sub-team: ${team}
 Role filter: ${roleDisplay}
 Loop mode: ${args.loop}

───────────────────────────────────────────────────────────
 STATUS
───────────────────────────────────────────────────────────

 Total tasks: ${total}
 Open tasks: ${open}

───────────────────────────────────────────────────────────

TEAMWORK_DIR=${teamworkDir}
PROJECT=${project}
SUB_TEAM=${team}
ROLE_FILTER=${args.role || ''}
LOOP_MODE=${args.loop}
OPEN_TASKS=${open}`);

  // Exit with error if no open tasks
  if (open === 0) {
    console.error('');
    console.error('⚠️  No open tasks available.');
    console.error('   All tasks may be complete or claimed by other workers.');
    console.error('');
    console.error('   Check status: /teamwork-status');
    process.exit(1);
  }

  process.exit(0);
}

// ============================================================================
// Entry Point
// ============================================================================

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
