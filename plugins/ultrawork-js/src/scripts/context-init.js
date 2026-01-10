#!/usr/bin/env node
/**
 * context-init.js - Initialize context.json with expected explorers
 * Usage: context-init.js --session <ID> --expected "overview,exp-1,exp-2,exp-3"
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir } = require('../lib/session-utils.js');

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

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * Parse command-line arguments
 * @returns {{sessionId: string, expected: string}} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let sessionId = '';
  let expected = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--session':
        sessionId = args[++i] || '';
        break;
      case '--expected':
        expected = args[++i] || '';
        break;
      case '-h':
      case '--help':
        console.log('Usage: context-init.js --session <ID> --expected "overview,exp-1,exp-2"');
        console.log('');
        console.log('Initializes context.json with expected explorer IDs.');
        console.log('exploration_complete will be set to true when all expected explorers are added.');
        process.exit(0);
    }
  }

  if (!sessionId || !expected) {
    console.error('Error: --session and --expected required');
    process.exit(1);
  }

  return { sessionId, expected };
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  const { sessionId, expected } = parseArgs();

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
