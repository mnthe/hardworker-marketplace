#!/usr/bin/env bun
/**
 * Project Get Script
 * Reads and outputs teamwork project.json file
 *
 * Usage: project-get.js --project <name> --team <name>
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectFile } = require('../lib/project-utils.js');
const { getNestedField } = require('../lib/field-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} project
 * @property {string} team
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--field': { key: 'field', aliases: ['-f'] },
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
    console.log(generateHelp('project-get.js', ARG_SPEC, 'Retrieve and output teamwork project metadata or extract specific field with dot notation'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Get project file path
  const projectFile = getProjectFile(args.project, args.team);

  if (!fs.existsSync(projectFile)) {
    console.error(`Error: Project not found: ${args.project}/${args.team}`);
    process.exit(1);
  }

  // Read and parse project data
  const content = fs.readFileSync(projectFile, 'utf-8');
  const project = JSON.parse(content);

  // Output result
  if (args.field) {
    // Extract specific field
    const value = getNestedField(project, args.field);

    if (value === undefined) {
      console.error(`Error: Field '${args.field}' not found in project`);
      process.exit(1);
    }

    // Output field value
    if (typeof value === 'string') {
      console.log(value);
    } else {
      console.log(JSON.stringify(value, null, 2));
    }
  } else {
    // Output entire project
    console.log(JSON.stringify(project, null, 2));
  }
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
