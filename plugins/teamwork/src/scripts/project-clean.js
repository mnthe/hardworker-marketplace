#!/usr/bin/env bun
/**
 * Project Clean Script (v3 - delete metadata directory)
 *
 * Deletes the project metadata directory (~/.claude/teamwork/{project}/{team}/).
 * Does NOT handle team deletion - native TeamDelete handles that.
 *
 * Usage: project-clean.js --project <name> --team <name>
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
    console.log(generateHelp('project-clean.js', ARG_SPEC, 'Delete teamwork project metadata directory'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  const { project, team } = args;

  // Verify project exists
  const projectFile = getProjectFile(project, team);
  if (!fs.existsSync(projectFile)) {
    console.error(`Error: Project not found: ${project}/${team}`);
    process.exit(1);
  }

  // Read project data for confirmation output
  let projectData;
  try {
    const content = fs.readFileSync(projectFile, 'utf-8');
    projectData = JSON.parse(content);
  } catch (error) {
    console.error(`Error: Failed to read project.json: ${error.message}`);
    process.exit(1);
  }

  // Delete the entire project directory
  const projectDir = getProjectDir(project, team);
  fs.rmSync(projectDir, { recursive: true, force: true });

  // Generate timestamp
  const timestamp = new Date().toISOString();

  // Build output JSON
  const output = {
    project: project,
    team: team,
    goal: projectData.goal,
    cleaned_at: timestamp,
    deleted_dir: projectDir
  };

  // Output confirmation
  console.log(`Project ${project}/${team} cleaned at ${timestamp}`);
  console.log(JSON.stringify(output, null, 2));
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
