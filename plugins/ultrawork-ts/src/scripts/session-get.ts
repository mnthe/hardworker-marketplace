#!/usr/bin/env node
/**
 * session-get.ts - Get session info
 * Usage: session-get.ts --session <ID> [--field phase|goal|options] [--dir] [--file]
 * TypeScript port of session-get.sh
 */

import * as fs from 'fs';
import {
  getSessionDir,
  getSessionFile,
  resolveSessionId,
  readSession,
} from '../lib/session-utils';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliArgs {
  sessionId?: string;
  field?: string;
  getDir: boolean;
  getFile: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    getDir: false,
    getFile: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--session':
        args.sessionId = argv[++i];
        break;
      case '--field':
        args.field = argv[++i];
        break;
      case '--dir':
        args.getDir = true;
        break;
      case '--file':
        args.getFile = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log('Usage: session-get.ts --session <ID> [--field phase|goal|options] [--dir] [--file]');
  console.log('');
  console.log('Options:');
  console.log('  --session <ID>   Session ID (required)');
  console.log('  --field <name>   Get specific field from session.json');
  console.log('  --dir            Return session directory path');
  console.log('  --file           Return session.json file path');
}

// ============================================================================
// Main Logic
// ============================================================================

function getFieldValue(obj: any, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let value = obj;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return null;
    }
  }

  return value;
}

function main(): void {
  const args = parseArgs(process.argv);

  // Show help
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate session ID
  if (!args.sessionId) {
    console.error('Error: --session <ID> required');
    process.exit(1);
  }

  // Return session directory path
  if (args.getDir) {
    const dir = getSessionDir(args.sessionId);
    console.log(dir);
    process.exit(0);
  }

  // Return session file path
  if (args.getFile) {
    const file = getSessionFile(args.sessionId);
    console.log(file);
    process.exit(0);
  }

  // Resolve session ID to file path (validates existence)
  try {
    const sessionFile = resolveSessionId(args.sessionId);

    // Get specific field or entire session
    if (args.field) {
      const session = readSession(args.sessionId);
      const value = getFieldValue(session, args.field);

      if (value === null || value === undefined) {
        console.error(`Error: Field '${args.field}' not found in session`);
        process.exit(1);
      }

      // Output value (JSON if object, raw if primitive)
      if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }
    } else {
      // Output entire session.json
      const content = fs.readFileSync(sessionFile, 'utf-8');
      console.log(content);
    }

    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { parseArgs, getFieldValue };
