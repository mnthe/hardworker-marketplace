#!/usr/bin/env node
/**
 * Teamwork Setup Script
 * JavaScript port of setup-teamwork.sh
 * Creates project structure for multi-session collaboration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  getTeamworkBase,
  getProjectDir,
  getProjectFile,
} = require('../lib/project-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} goal
 * @property {string} project
 * @property {string} team
 * @property {boolean} help
 */

/**
 * Show help message
 * @returns {void}
 */
function showHelp() {
  console.log(`\
═══════════════════════════════════════════════════════════
 TEAMWORK - Multi-Session Collaboration Mode
═══════════════════════════════════════════════════════════

USAGE:
  /teamwork [OPTIONS] <GOAL...>

ARGUMENTS:
  GOAL...    Project goal (can be multiple words without quotes)

OPTIONS:
  --project NAME    Override project name (default: git repo name)
  --team NAME       Override sub-team name (default: branch name)
  -h, --help        Show this help message

───────────────────────────────────────────────────────────
 WHAT IT DOES
───────────────────────────────────────────────────────────

Teamwork enables multi-session collaboration:

  ✓ File-per-task storage (no conflicts)
  ✓ Role-based workers (frontend, backend, etc.)
  ✓ Parallel execution across terminals
  ✓ Dashboard status view

───────────────────────────────────────────────────────────
 WORKFLOW
───────────────────────────────────────────────────────────

  1. COORDINATOR    Create project and tasks
                    → Analyze goal
                    → Break down work
                    → Assign roles

  2. WORKERS        Claim and complete tasks
                    → Each terminal = one worker
                    → Concurrent execution
                    → Evidence collection

  3. MONITOR        Track progress
                    → Dashboard view
                    → By-role breakdown
                    → Active workers

───────────────────────────────────────────────────────────
 EXAMPLES
───────────────────────────────────────────────────────────

  Basic usage:
    /teamwork build a payment processing system

  Override project:
    /teamwork --project payments add checkout flow

  Override sub-team:
    /teamwork --team sprint-5 implement user stories

───────────────────────────────────────────────────────────
 RELATED COMMANDS
───────────────────────────────────────────────────────────

  /teamwork-worker        Claim and complete tasks
  /teamwork-worker --loop Continuous worker mode
  /teamwork-status        Check project status

───────────────────────────────────────────────────────────
 DIRECTORY STRUCTURE
───────────────────────────────────────────────────────────

  ~/.claude/teamwork/{project}/{sub-team}/
    ├── project.json        # Project metadata
    └── tasks/
        ├── 1.json          # Task files
        ├── 2.json
        └── ...

═══════════════════════════════════════════════════════════`);
}

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {CliArgs} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {CliArgs} */
  const args = {
    goal: '',
    project: '',
    team: '',
    help: false,
  };

  /** @type {string[]} */
  const goalParts = [];
  let i = 2; // Skip node and script path

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

      default:
        // Positional argument (goal part)
        goalParts.push(arg);
        i++;
        break;
    }
  }

  args.goal = goalParts.join(' ');
  return args;
}

/**
 * Validate arguments
 * @param {CliArgs} args - Parsed arguments
 * @returns {void}
 */
function validateArgs(args) {
  if (args.help) {
    return; // Skip validation for help
  }

  if (!args.goal) {
    console.error('❌ Error: No goal provided');
    console.error('');
    console.error('   Usage: /teamwork <goal>');
    console.error('');
    console.error('   Examples:');
    console.error('     /teamwork build a REST API');
    console.error('     /teamwork --project myapp add authentication');
    console.error('');
    console.error('   For help: /teamwork --help');
    process.exit(1);
  }
}

/**
 * Detect project name from git repo
 * @returns {string} Project name
 */
function detectProjectName() {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return path.basename(gitRoot);
  } catch {
    return 'unknown';
  }
}

/**
 * Detect team name from git branch
 * @returns {string} Team name
 */
function detectTeamName() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return branch.replace(/\//g, '-');
  } catch {
    return 'main';
  }
}

// ============================================================================
// Main Entry Point
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

  // Validate arguments
  validateArgs(args);

  // Detect project name
  const project = args.project || detectProjectName();

  // Detect team name
  const team = args.team || detectTeamName();

  // Create directory structure
  const teamworkDir = getProjectDir(project, team);
  const tasksDir = path.join(teamworkDir, 'tasks');

  fs.mkdirSync(teamworkDir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });

  // Generate timestamp
  const timestamp = new Date().toISOString();

  // Output setup message
  console.log(`\
═══════════════════════════════════════════════════════════
 TEAMWORK PROJECT INITIALIZED
═══════════════════════════════════════════════════════════

 Project: ${project}
 Sub-team: ${team}
 Goal: ${args.goal}
 Started: ${timestamp}

───────────────────────────────────────────────────────────
 DIRECTORY
───────────────────────────────────────────────────────────

 ${teamworkDir}/
   ├── project.json
   └── tasks/

───────────────────────────────────────────────────────────
 NEXT STEPS
───────────────────────────────────────────────────────────

 Spawning coordinator to create tasks...

═══════════════════════════════════════════════════════════

TEAMWORK_DIR=${teamworkDir}
PROJECT=${project}
SUB_TEAM=${team}
GOAL=${args.goal}`);
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
