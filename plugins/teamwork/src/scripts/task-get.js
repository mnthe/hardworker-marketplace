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
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-T'], required: true },
  '--id': { key: 'id', aliases: ['-i', '--task', '--task-id'], required: true },
  '--field': { key: 'field', aliases: ['-f'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

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

  // Read and parse task JSON
  const content = fs.readFileSync(taskFile, 'utf-8');
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
      console.log(generateHelp('task-get.js', ARG_SPEC, 'Retrieve and output a single task by ID or extract specific field with dot notation'));
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
