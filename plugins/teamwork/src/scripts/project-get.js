#!/usr/bin/env bun
/**
 * Project Get Script
 * Reads and outputs teamwork project.json file
 */

const fs = require('fs');
const path = require('path');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} dir
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--dir': { key: 'dir', aliases: ['-d'], required: true },
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
    console.log(generateHelp('project-get.js', ARG_SPEC, 'Retrieve and output teamwork project metadata'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Check project file exists
  const projectFile = path.join(args.dir, 'project.json');

  if (!fs.existsSync(projectFile)) {
    console.error(`Error: Project file not found: ${projectFile}`);
    process.exit(1);
  }

  // Read and output project data
  const content = fs.readFileSync(projectFile, 'utf-8');
  console.log(content);
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
