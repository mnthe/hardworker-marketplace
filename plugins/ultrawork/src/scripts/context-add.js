#!/usr/bin/env bun
/**
 * context-add.js - Add explorer summary to context.json
 * Usage: context-add.js --session <ID> --explorer-id <id> --hint "..." --file "exploration/exp-1.md" --summary "..." --key-files "f1,f2" --patterns "p1,p2"
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
 * @typedef {Object} Args
 * @property {string} sessionId
 * @property {string} explorerId
 * @property {string} hint
 * @property {string} file
 * @property {string} summary
 * @property {string} keyFiles
 * @property {string} patterns
 */

/**
 * Parse command-line arguments
 * @returns {Args} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let sessionId = '';
  let explorerId = '';
  let hint = '';
  let file = '';
  let summary = '';
  let keyFiles = '';
  let patterns = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--session':
        sessionId = args[++i] || '';
        break;
      case '--explorer-id':
        explorerId = args[++i] || '';
        break;
      case '--hint':
        hint = args[++i] || '';
        break;
      case '--file':
        file = args[++i] || '';
        break;
      case '--summary':
        summary = args[++i] || '';
        break;
      case '--key-files':
        keyFiles = args[++i] || '';
        break;
      case '--patterns':
        patterns = args[++i] || '';
        break;
      case '-h':
      case '--help':
        console.log('Usage: context-add.js --session <ID> --explorer-id <id> --hint "..." --file "exploration/exp-1.md" --summary "..." --key-files "f1,f2" --patterns "p1,p2"');
        console.log('');
        console.log('Adds a lightweight explorer entry to context.json with link to detailed markdown.');
        process.exit(0);
    }
  }

  if (!sessionId || !explorerId) {
    console.error('Error: --session and --explorer-id required');
    process.exit(1);
  }

  return { sessionId, explorerId, hint, file, summary, keyFiles, patterns };
}

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
  const { sessionId, explorerId, hint, file, summary, keyFiles, patterns } = parseArgs();

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
