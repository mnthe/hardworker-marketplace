#!/usr/bin/env bun
/**
 * Teamwork Setup Script
 * Creates project structure for multi-session collaboration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');
const {
  getProjectDir,
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

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'] },
  '--team': { key: 'team', aliases: ['-t'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

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
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('setup-teamwork.js', ARG_SPEC, 'Initialize teamwork project structure for multi-session collaboration'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Collect positional arguments for goal
  const goalParts = [];
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    // Skip flag arguments and their values
    if (arg === '--project' || arg === '-p' || arg === '--team' || arg === '-t') {
      i++; // Skip next value
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      continue;
    }
    // Collect positional arg
    goalParts.push(arg);
  }
  const goal = goalParts.join(' ');

  // Create args object with goal
  /** @type {CliArgs} */
  const fullArgs = {
    goal,
    project: args.project || '',
    team: args.team || '',
    help: args.help || false
  };

  // Validate arguments
  validateArgs(fullArgs);

  // Detect project name
  const project = fullArgs.project || detectProjectName();

  // Detect team name
  const team = fullArgs.team || detectTeamName();

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
 Goal: ${goal}
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

 Spawning orchestrator to create tasks...

═══════════════════════════════════════════════════════════

TEAMWORK_DIR=${teamworkDir}
PROJECT=${project}
SUB_TEAM=${team}
GOAL=${goal}`);
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
