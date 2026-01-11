#!/usr/bin/env bun
/**
 * context-init.js - Initialize context.json with expected explorers
 * Usage: context-init.js --session <ID> --expected "overview,exp-1,exp-2,exp-3"
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Types
// ============================================================================

/**
 * @typedef {Object} Explorer
 * @property {string} id
 * @property {string} hint
 * @property {string} file
 * @property {string} summary
 */

/**
 * @typedef {Object} ContextFile
 * @property {string} version
 * @property {string[]} expected_explorers
 * @property {boolean} exploration_complete
 * @property {Explorer[]} explorers
 * @property {string[]} key_files
 * @property {string[]} patterns
 * @property {string[]} constraints
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', alias: '-s', required: true },
  '--expected': { key: 'expected', alias: '-e', required: true },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('context-init.js', ARG_SPEC, 'Initialize context.json with expected explorer IDs for tracking exploration completion'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  const { sessionId, expected } = args;

  try {
    // Get session directory
    const sessionDir = getSessionDir(sessionId);
    const contextFile = path.join(sessionDir, 'context.json');

    // Parse expected explorers from comma-separated string
    const expectedExplorers = expected
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    // Check if context.json exists
    if (fs.existsSync(contextFile)) {
      // Update existing context.json
      const content = fs.readFileSync(contextFile, 'utf-8');
      /** @type {ContextFile} */
      const context = JSON.parse(content);

      context.expected_explorers = expectedExplorers;
      context.exploration_complete = false;

      fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
    } else {
      // Create new context.json
      /** @type {ContextFile} */
      const newContext = {
        version: '2.1',
        expected_explorers: expectedExplorers,
        exploration_complete: false,
        explorers: [],
        key_files: [],
        patterns: [],
        constraints: [],
      };

      fs.writeFileSync(contextFile, JSON.stringify(newContext, null, 2), 'utf-8');
    }

    console.log('OK: context.json initialized');
    console.log(`    Expected explorers: ${expected}`);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
  main();
}
