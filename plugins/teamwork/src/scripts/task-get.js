#!/usr/bin/env bun
/**
 * task-get.js - Get single task details
 * CLI to retrieve task file contents
 *
 * Usage: task-get.js --project <name> --team <name> --id <task_id>
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getTaskFile } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [id]
 */

const ARG_SPEC = {
  '--project': { key: 'project', alias: '-p', required: true },
  '--team': { key: 'team', alias: '-t', required: true },
  '--id': { key: 'id', alias: '-i', required: true },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Task Retrieval
// ============================================================================

/**
 * Get task file
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function getTask(args) {
  const taskFile = getTaskFile(args.project, args.team, args.id);

  if (!fs.existsSync(taskFile)) {
    console.error(`Error: Task ${args.id} not found`);
    process.exit(1);
  }

  // Read and output task JSON
  const content = fs.readFileSync(taskFile, 'utf-8');
  console.log(content);
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  try {
    // Check for help flag first
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(generateHelp('task-get.js', ARG_SPEC, 'Retrieve and output a single task by ID'));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

    getTask(args);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Unknown error occurred');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
