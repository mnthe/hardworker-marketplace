#!/usr/bin/env bun
/**
 * task-get.js - Get single task details
 * Usage: task-get.js --session <ID> --task-id <id> [--field <field>]
 * Aliases: --task-id, --task, --id (all accepted for task identification)
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

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

const ARG_SPEC = {
  '--session': { key: 'session', aliases: ['-s'], required: true },
  '--id': { key: 'id', aliases: ['-t', '--task', '--task-id'], required: true },
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
// Main Function
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('task-get.js', ARG_SPEC, 'Get single task details or extract specific field with dot notation'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

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
