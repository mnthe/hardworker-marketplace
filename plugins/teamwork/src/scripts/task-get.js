#!/usr/bin/env bun
/**
 * task-get.js - Get single task details
 * CLI to retrieve task file contents
 *
 * Usage: task-get.js --project <name> --team <name> --id <task_id>
 */

const fs = require('fs');
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

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {CliArgs} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {CliArgs} */
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--project':
        args.project = argv[++i];
        break;
      case '--team':
        args.team = argv[++i];
        break;
      case '--id':
        args.id = argv[++i];
        break;
      case '-h':
      case '--help':
        console.log('Usage: task-get.js --project <name> --team <name> --id <task_id>');
        process.exit(0);
        break;
    }
  }

  return args;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate CLI arguments
 * @param {CliArgs} args - Arguments to validate
 * @returns {void}
 */
function validateArgs(args) {
  if (!args.project) {
    console.error('Error: --project required');
    process.exit(1);
  }

  if (!args.team) {
    console.error('Error: --team required');
    process.exit(1);
  }

  if (!args.id) {
    console.error('Error: --id required');
    process.exit(1);
  }
}

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
    const args = parseArgs(process.argv.slice(2));
    validateArgs(args);
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
