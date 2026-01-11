#!/usr/bin/env bun
/**
 * Teamwork Worker Setup Script
 * Prepares worker environment and validates project exists
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  getProjectDir,
  getProjectFile,
  getTasksDir,
  projectExists,
  listTasks,
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

/**
 * Show help message
 * @returns {void}
 */
function showHelp() {
  console.log(`\
═══════════════════════════════════════════════════════════
 TEAMWORK WORKER - Claim and Complete Tasks
═══════════════════════════════════════════════════════════

USAGE:
  /teamwork-worker [OPTIONS]

OPTIONS:
  --project NAME    Override project name (default: git repo name)
  --team NAME       Override sub-team name (default: branch name)
  --role ROLE       Only claim tasks with this role
  --loop            Continuous mode (keep claiming tasks)
  -h, --help        Show this help message

───────────────────────────────────────────────────────────
 ROLES
───────────────────────────────────────────────────────────

  frontend    UI, components, styling
  backend     API, services, database
  test        Tests, fixtures, mocks
  devops      CI/CD, deployment
  docs        Documentation
  security    Auth, permissions
  review      Code review

───────────────────────────────────────────────────────────
 EXAMPLES
───────────────────────────────────────────────────────────

  One-shot mode (complete one task):
    /teamwork-worker

  Continuous mode (keep working):
    /teamwork-worker --loop

  Role-specific:
    /teamwork-worker --role frontend
    /teamwork-worker --role backend --loop

  Specific project:
    /teamwork-worker --project myapp --team feature-x

───────────────────────────────────────────────────────────
 HOW IT WORKS
───────────────────────────────────────────────────────────

  1. Find an open, unblocked task
  2. Claim it (mark as owned)
  3. Complete the work
  4. Collect evidence
  5. Mark as resolved

  In --loop mode, repeat until no tasks remain.

═══════════════════════════════════════════════════════════`);
}

/**
 * Valid worker roles
 * @type {Role[]}
 */
const VALID_ROLES = ['frontend', 'backend', 'devops', 'test', 'docs', 'security', 'review', 'worker'];

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {CliArgs} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {CliArgs} */
  const args = {
    project: '',
    team: '',
    role: null,
    loop: false,
    help: false,
  };

  let i = 2; // Skip 'bun' and script path

  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '-h':
      case '--help':
        args.help = true;
        i++;
        break;

      case '--project': {
        const value = argv[i + 1];
        if (!value) {
          console.error('❌ Error: --project requires a name argument');
          process.exit(1);
        }
        args.project = value;
        i += 2;
        break;
      }

      case '--team': {
        const value = argv[i + 1];
        if (!value) {
          console.error('❌ Error: --team requires a name argument');
          process.exit(1);
        }
        args.team = value;
        i += 2;
        break;
      }

      case '--role': {
        const value = argv[i + 1];
        if (!value) {
          console.error('❌ Error: --role requires a role name');
          console.error('   Valid roles: frontend, backend, test, devops, docs, security, review');
          process.exit(1);
        }
        if (!VALID_ROLES.includes(value)) {
          console.error(`❌ Error: Invalid role "${value}"`);
          console.error('   Valid roles: frontend, backend, test, devops, docs, security, review');
          process.exit(1);
        }
        args.role = /** @type {Role} */ (value);
        i += 2;
        break;
      }

      case '--loop':
        args.loop = true;
        i++;
        break;

      default:
        console.error(`⚠️  Unknown argument: ${arg}`);
        i++;
        break;
    }
  }

  return args;
}

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
  const args = parseArgs(process.argv);

  // Show help if requested
  if (args.help) {
    showHelp();
    process.exit(0);
  }

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
