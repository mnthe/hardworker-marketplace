#!/usr/bin/env node
/**
 * Project Create Script
 * JavaScript port of project-create.sh
 * Creates teamwork project.json file
 */

const fs = require('fs');
const path = require('path');
const {
  getProjectDir,
  getProjectFile,
  writeProject,
} = require('../lib/project-utils.js');

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

/**
 * Show help message
 * @returns {void}
 */
function showHelp() {
  console.log('Usage: project-create.js --dir <path> --project <name> --team <name> --goal "..."');
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
    project: '',
    team: '',
    goal: '',
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

      case '--project': {
        const value = argv[i + 1];
        if (!value) {
          console.error('Error: --project requires a name argument');
          process.exit(1);
        }
        args.project = value;
        i += 2;
        break;
      }

      case '--team': {
        const value = argv[i + 1];
        if (!value) {
          console.error('Error: --team requires a name argument');
          process.exit(1);
        }
        args.team = value;
        i += 2;
        break;
      }

      case '--goal': {
        const value = argv[i + 1];
        if (!value) {
          console.error('Error: --goal requires a string argument');
          process.exit(1);
        }
        args.goal = value;
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

  const missing = [];
  if (!args.dir) missing.push('--dir');
  if (!args.project) missing.push('--project');
  if (!args.team) missing.push('--team');
  if (!args.goal) missing.push('--goal');

  if (missing.length > 0) {
    console.error(`Error: ${missing.join(', ')} required`);
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
