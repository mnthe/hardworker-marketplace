#!/usr/bin/env node
/**
 * Project Get Script
 * JavaScript port of project-get.sh
 * Reads and outputs teamwork project.json file
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} dir
 * @property {boolean} help
 */

/**
 * Show help message
 * @returns {void}
 */
function showHelp() {
  console.log('Usage: project-get.js --dir <path>');
}

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {CliArgs} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {CliArgs} */
  const args = {
    dir: '',
    help: false,
  };

  let i = 2; // Skip node and script path

  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '-h':
      case '--help':
        args.help = true;
        i++;
        break;

      case '--dir': {
        const value = argv[i + 1];
        if (!value) {
          console.error('Error: --dir requires a path argument');
          process.exit(1);
        }
        args.dir = value;
        i += 2;
        break;
      }

      default:
        i++;
        break;
    }
  }

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

  if (!args.dir) {
    console.error('Error: --dir required');
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
  const args = parseArgs(process.argv);

  // Show help if requested
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate arguments
  validateArgs(args);

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
