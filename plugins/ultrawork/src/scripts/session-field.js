#!/usr/bin/env bun
/**
 * session-field.js - Optimized single field extraction from session
 *
 * Purpose: Avoid full JSON parse when only one field is needed.
 * For top-level fields (phase, goal, etc.), uses regex on partial file read.
 * For nested fields, falls back to full parse.
 *
 * Usage: session-field.js --session <ID> --field <field_path>
 *
 * Output: Plain value (not JSON wrapped) - token efficient
 *
 * Examples:
 *   session-field.js --session abc-123 --field phase
 *   # Output: PLANNING
 *
 *   session-field.js --session abc-123 --field options.auto_mode
 *   # Output: true
 */

const fs = require('fs');
const { resolveSessionId } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'], required: true },
  '--field': { key: 'field', aliases: ['-f'], required: true },
  '--json': { key: 'asJson', aliases: ['-j'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Optimized Field Extraction
// ============================================================================

/**
 * Top-level fields that can be extracted via regex (simple string/number/boolean)
 */
const TOP_LEVEL_SIMPLE_FIELDS = new Set([
  'version',
  'session_id',
  'working_dir',
  'goal',
  'phase',
  'exploration_stage',
  'iteration',
  'started_at',
  'updated_at',
  'cancelled_at'
]);

/**
 * Extract a top-level simple field using regex (avoids full JSON parse)
 * Only works for string, number, boolean, null values at top level
 *
 * @param {string} content - File content (partial or full)
 * @param {string} fieldName - Field name to extract
 * @returns {string | number | boolean | null | undefined} Extracted value or undefined
 */
function extractTopLevelField(content, fieldName) {
  // Pattern: "fieldName": "value" or "fieldName": value
  // Handles: strings, numbers, booleans, null
  const pattern = new RegExp(
    `"${fieldName}"\\s*:\\s*("([^"\\\\]*(\\\\.[^"\\\\]*)*)"|(-?\\d+\\.?\\d*)|true|false|null)`,
    'm'
  );

  const match = content.match(pattern);
  if (!match) return undefined;

  const rawValue = match[1];

  // Parse the matched value
  if (rawValue.startsWith('"')) {
    // String value - remove quotes and unescape
    return rawValue.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  } else if (rawValue === 'true') {
    return true;
  } else if (rawValue === 'false') {
    return false;
  } else if (rawValue === 'null') {
    return null;
  } else {
    // Number
    return parseFloat(rawValue);
  }
}

/**
 * Get field value from nested object using dot notation
 * @param {any} obj - Object to query
 * @param {string} fieldPath - Dot-separated field path
 * @returns {any} Field value or undefined
 */
function getNestedField(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let value = obj;

  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'object') return undefined;
    value = value[part];
  }

  return value;
}

/**
 * Extract field from session file with optimized reading
 *
 * @param {string} sessionFile - Path to session.json
 * @param {string} fieldPath - Field path (dot notation for nested)
 * @returns {{ value: any, optimized: boolean }} Result with optimization flag
 */
function extractField(sessionFile, fieldPath) {
  const isTopLevel = !fieldPath.includes('.');
  const fieldName = isTopLevel ? fieldPath : fieldPath.split('.')[0];

  // Optimization: for known simple top-level fields, read partial file
  if (isTopLevel && TOP_LEVEL_SIMPLE_FIELDS.has(fieldName)) {
    // Read first 2KB - enough for header fields
    const fd = fs.openSync(sessionFile, 'r');
    const buffer = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);

    const partialContent = buffer.toString('utf-8', 0, bytesRead);
    const value = extractTopLevelField(partialContent, fieldName);

    if (value !== undefined) {
      return { value, optimized: true };
    }
    // Fall through to full parse if not found in partial
  }

  // Full parse for nested fields or complex values
  const content = fs.readFileSync(sessionFile, 'utf-8');
  const session = JSON.parse(content);
  const value = getNestedField(session, fieldPath);

  return { value, optimized: false };
}

// ============================================================================
// Main Execution
// ============================================================================

function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('session-field.js', ARG_SPEC,
      'Extract single field from session with optimized reading.\n' +
      'For top-level simple fields, avoids full JSON parse.\n' +
      'Output is plain value (token-efficient) unless --json flag is used.'
    ));
    console.log('\nSupported optimized fields:');
    console.log('  ' + Array.from(TOP_LEVEL_SIMPLE_FIELDS).join(', '));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  try {
    // Validate session exists
    const sessionFile = resolveSessionId(args.sessionId);

    // Extract field
    const result = extractField(sessionFile, args.field);

    if (result.value === undefined) {
      console.error(`Error: Field '${args.field}' not found`);
      process.exit(1);
    }

    // Output
    if (args.asJson) {
      // JSON wrapped output
      console.log(JSON.stringify({
        field: args.field,
        value: result.value,
        optimized: result.optimized
      }));
    } else {
      // Plain value output (token efficient)
      if (typeof result.value === 'object') {
        console.log(JSON.stringify(result.value));
      } else {
        console.log(result.value);
      }
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

module.exports = { extractField, extractTopLevelField, getNestedField };
