#!/usr/bin/env bun
/**
 * Project Create Script
 * Creates teamwork project.json file
 */

const fs = require('fs');
const path = require('path');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Project} Project
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} dir
 * @property {string} project
 * @property {string} team
 * @property {string} goal
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--dir': { key: 'dir', aliases: ['-d'], required: true },
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--goal': { key: 'goal', aliases: ['-g'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

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
    console.log(generateHelp('project-create.js', ARG_SPEC, 'Create a new teamwork project with metadata and directory structure'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Create directory
  const tasksDir = path.join(args.dir, 'tasks');
  fs.mkdirSync(args.dir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });

  // Generate timestamp
  const timestamp = new Date().toISOString();

  // Create project data
  /** @type {Project} */
  const projectData = {
    project: args.project,
    team: args.team,
    goal: args.goal,
    created_at: timestamp,
    updated_at: timestamp,
    stats: {
      total: 0,
      open: 0,
      in_progress: 0,
      resolved: 0,
    },
  };

  // Write project.json
  const projectFile = path.join(args.dir, 'project.json');
  fs.writeFileSync(projectFile, JSON.stringify(projectData, null, 2), 'utf-8');

  // Output success message and project data
  console.log('OK: Project created');
  console.log(JSON.stringify(projectData, null, 2));
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
