#!/usr/bin/env bun
/**
 * Teamwork Setup Script (v3 - native teammate based)
 *
 * Checks for native agent teams support, creates project metadata directory,
 * and outputs project info JSON. No task creation - native TaskCreate handles that.
 *
 * Usage: setup-teamwork.js --project <name> --team <name> --goal "..."
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir } = require('../lib/project-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--goal': { key: 'goal', aliases: ['-g'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Environment Validation
// ============================================================================

/**
 * Check that native agent teams feature is enabled
 * @returns {void}
 */
function checkAgentTeamsEnv() {
  const envVal = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  if (envVal !== '1') {
    console.error('Error: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 is required');
    console.error('');
    console.error('  Set the environment variable before running teamwork:');
    console.error('  export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1');
    process.exit(1);
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
    console.log(generateHelp('setup-teamwork.js', ARG_SPEC, 'Initialize teamwork project for native agent teams collaboration'));
    process.exit(0);
  }

  // Check environment variable
  checkAgentTeamsEnv();

  const args = parseArgs(ARG_SPEC);

  // Create project metadata directory
  const projectDir = getProjectDir(args.project, args.team);
  fs.mkdirSync(projectDir, { recursive: true });

  // Generate timestamp
  const timestamp = new Date().toISOString();

  // Build output JSON
  const output = {
    project: args.project,
    team: args.team,
    goal: args.goal,
    created_at: timestamp,
    project_dir: projectDir
  };

  // Output project info as JSON
  console.log(JSON.stringify(output, null, 2));
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
