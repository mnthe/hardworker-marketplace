#!/usr/bin/env bun
/**
 * context-add.js - Add explorer summary to context.json
 * Usage: context-add.js --session <ID> --explorer-id <id> --hint "..." --file "exploration/exp-1.md" --summary "..." --key-files "f1,f2" --patterns "p1,p2"
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
  '--explorer-id': { key: 'explorerId', alias: '-e', required: true },
  '--hint': { key: 'hint', alias: '-H', default: '' },
  '--file': { key: 'file', alias: '-f', default: '' },
  '--summary': { key: 'summary', alias: '-S', default: '' },
  '--key-files': { key: 'keyFiles', alias: '-k', default: '' },
  '--patterns': { key: 'patterns', alias: '-p', default: '' },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse comma-separated string into array, filtering empty strings
 * @param {string} input - Comma-separated string
 * @returns {string[]} Array of strings
 */
function parseCommaSeparated(input) {
  if (!input) {
    return [];
  }
  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Merge arrays and remove duplicates
 * @param {string[]} arr1 - First array
 * @param {string[]} arr2 - Second array
 * @returns {string[]} Merged unique array
 */
function mergeUnique(arr1, arr2) {
  return Array.from(new Set([...arr1, ...arr2]));
}

/**
 * Check if two sorted arrays are equal
 * @param {string[]} arr1 - First array
 * @param {string[]} arr2 - Second array
 * @returns {boolean} True if arrays are equal
 */
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  return sorted1.every((val, idx) => val === sorted2[idx]);
}

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
    console.log(generateHelp('context-add.js', ARG_SPEC, 'Add explorer summary to context.json with key files and patterns'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  const { sessionId, explorerId, hint, file, summary, keyFiles, patterns } = args;

  try {
    // Get session directory
    const sessionDir = getSessionDir(sessionId);
    const contextFile = path.join(sessionDir, 'context.json');

    // Initialize context.json if it doesn't exist
    if (!fs.existsSync(contextFile)) {
      /** @type {ContextFile} */
      const initialContext = {
        version: '2.1',
        expected_explorers: [],
        exploration_complete: false,
        explorers: [],
        key_files: [],
        patterns: [],
        constraints: [],
      };
      fs.writeFileSync(contextFile, JSON.stringify(initialContext, null, 2), 'utf-8');
    }

    // Read current context
    const content = fs.readFileSync(contextFile, 'utf-8');
    /** @type {ContextFile} */
    const context = JSON.parse(content);

    // Check if explorer already exists (avoid duplicates)
    const existingExplorer = context.explorers.find((exp) => exp.id === explorerId);
    if (existingExplorer) {
      console.log(`Warning: Explorer ${explorerId} already exists, skipping`);
      process.exit(0);
    }

    // Parse key files and patterns
    const newKeyFiles = parseCommaSeparated(keyFiles);
    const newPatterns = parseCommaSeparated(patterns);

    // Build new explorer entry (lightweight - just summary and link)
    /** @type {Explorer} */
    const newExplorer = {
      id: explorerId,
      hint: hint || '',
      file: file || '',
      summary: summary || '',
    };

    // Add explorer to context
    context.explorers.push(newExplorer);

    // Merge and deduplicate key_files
    context.key_files = mergeUnique(context.key_files || [], newKeyFiles);

    // Merge and deduplicate patterns
    context.patterns = mergeUnique(context.patterns || [], newPatterns);

    // Check if all expected explorers are complete
    if (context.expected_explorers && context.expected_explorers.length > 0) {
      const actualIds = context.explorers.map((exp) => exp.id);
      if (arraysEqual(context.expected_explorers, actualIds)) {
        context.exploration_complete = true;
        fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
        console.log('OK: All expected explorers complete. exploration_complete=true');
      } else {
        fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
      }
    } else {
      fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
    }

    console.log(`OK: Explorer ${explorerId} added to context.json`);
    console.log(`    File: ${file}`);
    console.log(`    Summary: ${summary.substring(0, 50)}...`);
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
