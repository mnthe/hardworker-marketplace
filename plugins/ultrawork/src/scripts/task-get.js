#!/usr/bin/env node
/**
 * task-get.js - Get single task details
 * Usage: task-get.js --session <ID> --id <task_id> [--field <field>]
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir } = require('../lib/session-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 */

/**
 * @typedef {Object} Args
 * @property {string} [session]
 * @property {string} [id]
 * @property {string} [field]
 * @property {boolean} [help]
 */

/**
 * Parse command-line arguments
 * @param {string[]} argv - Process argv array
 * @returns {Args} Parsed arguments
 */
function parseArgs(argv) {
  /** @type {Args} */
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--session':
        args.session = argv[++i];
        break;
      case '--id':
        args.id = argv[++i];
        break;
      case '--field':
        args.field = argv[++i];
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
    }
  }

  return args;
}

// ============================================================================
// Field Extraction
// ============================================================================

/**
 * Extract nested field from object using dot notation
 * Example: "status" or "evidence[0].type"
 * @param {any} obj - Object to query
 * @param {string} fieldPath - Dot-separated field path
 * @returns {any} Field value or undefined
 */
function getNestedField(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let current = obj;

  for (const part of parts) {
    // Handle array access: field[0]
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      const [, fieldName, index] = match;
      current = current[fieldName];
      if (!current || !Array.isArray(current)) {
        return undefined;
      }
      current = current[parseInt(index, 10)];
    } else {
      current = current[part];
    }

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  const args = parseArgs(process.argv.slice(2));

  // Handle help
  if (args.help) {
    console.log('Usage: task-get.js --session <ID> --id <task_id> [--field <field>]');
    console.log('');
    console.log('Options:');
    console.log('  --session <ID>     Session ID (required)');
    console.log('  --id <task_id>     Task ID (required)');
    console.log('  --field <field>    Extract specific field (optional)');
    console.log('  -h, --help         Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  task-get.js --session abc123 --id 1');
    console.log('  task-get.js --session abc123 --id 1 --field status');
    console.log('  task-get.js --session abc123 --id 1 --field evidence[0].type');
    process.exit(0);
  }

  // Validate required args
  if (!args.session || !args.id) {
    console.error('Error: --session and --id required');
    process.exit(1);
  }

  try {
    // Get session directory
    const sessionDir = getSessionDir(args.session);
    const taskFile = path.join(sessionDir, 'tasks', `${args.id}.json`);

    // Check if task file exists
    if (!fs.existsSync(taskFile)) {
      console.error(`Error: Task ${args.id} not found`);
      process.exit(1);
    }

    // Read task
    const content = fs.readFileSync(taskFile, 'utf-8');
    /** @type {Task} */
    const task = JSON.parse(content);

    // Output result
    if (args.field) {
      // Extract specific field
      const value = getNestedField(task, args.field);

      if (value === undefined) {
        console.error(`Error: Field '${args.field}' not found in task`);
        process.exit(1);
      }

      // Output field value
      if (typeof value === 'string') {
        console.log(value);
      } else {
        console.log(JSON.stringify(value, null, 2));
      }
    } else {
      // Output entire task
      console.log(JSON.stringify(task, null, 2));
    }

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Unknown error occurred');
    }
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
  main();
}
