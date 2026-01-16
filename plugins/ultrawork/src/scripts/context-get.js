#!/usr/bin/env bun
/**
 * context-get.js - Get context.json data with field extraction
 * Usage: context-get.js --session <ID> [--field explorers|key_files|...] [--file]
 *
 * Provides efficient access to context.json data without loading full JSON into agent context.
 * Supports dot notation for nested fields (e.g., "scopeExpansion.detectedLayers")
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
 * @property {Object|null} scopeExpansion
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'], required: true },
  '--field': { key: 'field', aliases: ['-f'] },
  '--file': { key: 'getFile', aliases: ['-F'], flag: true },
  '--summary': { key: 'summary', aliases: ['-S'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get field value from nested object using dot notation
 * @param {any} obj - Object to query
 * @param {string} fieldPath - Dot-separated field path (e.g., "scopeExpansion.detectedLayers")
 * @returns {any} Field value or null
 */
function getFieldValue(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let value = obj;

  for (const part of parts) {
    // Handle array index notation: explorers[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
        if (Array.isArray(value)) {
          value = value[parseInt(index, 10)];
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return null;
    }
  }

  return value;
}

/**
 * Generate AI-friendly summary of context
 * @param {ContextFile} context - Context object
 * @returns {string} Markdown summary
 */
function generateSummary(context) {
  const lines = [];

  // Header with exploration status
  const status = context.exploration_complete ? 'Complete' : 'In Progress';
  lines.push(`# Context Summary (${status})`);
  lines.push('');

  // Explorers
  if (context.explorers && context.explorers.length > 0) {
    lines.push(`## Explorers (${context.explorers.length}/${context.expected_explorers?.length || '?'})`);
    for (const exp of context.explorers) {
      lines.push(`- **${exp.id}**: ${exp.summary || '(no summary)'}`);
      if (exp.file) {
        lines.push(`  - File: \`${exp.file}\``);
      }
    }
    lines.push('');
  }

  // Key files
  if (context.key_files && context.key_files.length > 0) {
    lines.push(`## Key Files (${context.key_files.length})`);
    for (const file of context.key_files) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  // Patterns
  if (context.patterns && context.patterns.length > 0) {
    lines.push(`## Patterns (${context.patterns.length})`);
    for (const pattern of context.patterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  // Scope expansion (if present)
  if (context.scopeExpansion) {
    const scope = context.scopeExpansion;
    lines.push('## Scope Expansion');
    lines.push(`- **Original**: ${scope.originalRequest || '(none)'}`);
    if (scope.detectedLayers) {
      lines.push(`- **Layers**: ${scope.detectedLayers.join(', ')}`);
    }
    if (scope.suggestedTasks && scope.suggestedTasks.length > 0) {
      lines.push('- **Suggested Tasks**:');
      for (const task of scope.suggestedTasks) {
        lines.push(`  - [${task.layer}] ${task.description}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
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
    console.log(
      generateHelp(
        'context-get.js',
        ARG_SPEC,
        'Get context.json data, specific field, or AI-friendly summary'
      )
    );
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);
  const { sessionId, field, getFile, summary } = args;

  try {
    const sessionDir = getSessionDir(sessionId);
    const contextFile = path.join(sessionDir, 'context.json');

    // Return file path only
    if (getFile) {
      console.log(contextFile);
      process.exit(0);
    }

    // Check if context.json exists
    if (!fs.existsSync(contextFile)) {
      console.error('Error: context.json not found. Run exploration first.');
      process.exit(1);
    }

    // Read context
    const content = fs.readFileSync(contextFile, 'utf-8');
    /** @type {ContextFile} */
    const context = JSON.parse(content);

    // Generate summary
    if (summary) {
      console.log(generateSummary(context));
      process.exit(0);
    }

    // Get specific field
    if (field) {
      const value = getFieldValue(context, field);

      if (value === null || value === undefined) {
        console.error(`Error: Field '${field}' not found in context`);
        process.exit(1);
      }

      // Output value (JSON if object/array, raw if primitive)
      if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }
      process.exit(0);
    }

    // Output entire context.json
    console.log(content);
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

module.exports = { getFieldValue, generateSummary };
