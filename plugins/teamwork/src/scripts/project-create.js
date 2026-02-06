#!/usr/bin/env bun
/**
 * Project Create Script (v3 - lightweight metadata only)
 *
 * Creates a lightweight project.json metadata file.
 * No task files, no wave system - native TaskCreate handles tasks.
 *
 * Usage: project-create.js --project <name> --team <name> --goal "..." [--options '{"key":"value"}']
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir, getProjectFile } = require('../lib/project-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--goal': { key: 'goal', aliases: ['-g'], required: true },
  '--options': { key: 'options', aliases: ['-o'] },
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
    console.log(generateHelp('project-create.js', ARG_SPEC, 'Create lightweight teamwork project metadata'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Create project directory (no tasks subdirectory - native handles tasks)
  const projectDir = getProjectDir(args.project, args.team);
  fs.mkdirSync(projectDir, { recursive: true });

  // Generate timestamp
  const timestamp = new Date().toISOString();

  // Parse optional options JSON
  let options = undefined;
  if (args.options) {
    try {
      options = JSON.parse(args.options);
    } catch (e) {
      console.error('Error: Invalid JSON in --options parameter');
      process.exit(1);
    }
  }

  // Create lightweight project data (no stats, no wave system)
  const projectData = {
    project: args.project,
    team: args.team,
    goal: args.goal,
    created_at: timestamp
  };

  // Add options only if provided
  if (options !== undefined) {
    projectData.options = options;
  }

  // Write project.json
  const projectFile = getProjectFile(args.project, args.team);
  fs.writeFileSync(projectFile, JSON.stringify(projectData, null, 2), 'utf-8');

  // Output project data as JSON
  console.log(JSON.stringify(projectData, null, 2));
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
