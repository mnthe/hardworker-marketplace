#!/usr/bin/env node
/**
 * task-get.ts - Get single task details
 * Usage: task-get.ts --session <ID> --id <task_id> [--field <field>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSessionDir } from '../lib/session-utils';
import { Task } from '../lib/types';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface Args {
  session?: string;
  id?: string;
  field?: string;
  help?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};

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
 */
function getNestedField(obj: any, fieldPath: string): any {
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

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  // Handle help
  if (args.help) {
    console.log('Usage: task-get.ts --session <ID> --id <task_id> [--field <field>]');
    console.log('');
    console.log('Options:');
    console.log('  --session <ID>     Session ID (required)');
    console.log('  --id <task_id>     Task ID (required)');
    console.log('  --field <field>    Extract specific field (optional)');
    console.log('  -h, --help         Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  task-get.ts --session abc123 --id 1');
    console.log('  task-get.ts --session abc123 --id 1 --field status');
    console.log('  task-get.ts --session abc123 --id 1 --field evidence[0].type');
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
    const task: Task = JSON.parse(content);

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
