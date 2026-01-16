#!/usr/bin/env bun
/**
 * session-get.js - Get session info
 * Usage: session-get.js --session <ID> [--field phase|goal|options] [--dir] [--file]
 */

const fs = require('fs');
const {
  getSessionDir,
  getSessionFile,
  resolveSessionId,
  readSession,
} = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Session} Session
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} [sessionId]
 * @property {string} [field]
 * @property {boolean} getDir
 * @property {boolean} getFile
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'], required: true },
  '--field': { key: 'field', aliases: ['-f'] },
  '--dir': { key: 'getDir', aliases: ['-d'], flag: true },
  '--file': { key: 'getFile', aliases: ['-F'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Get field value from nested object
 * @param {any} obj - Object to query
 * @param {string} fieldPath - Dot-separated field path
 * @returns {any} Field value or null
 */
function getFieldValue(obj, fieldPath) {
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

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('session-get.js', ARG_SPEC, 'Get session info, specific field, directory path, or file path'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

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
