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

const { resolveSessionId } = require('../lib/session-utils.js');
const { extractField, extractTopLevelField, getNestedField, TOP_LEVEL_SIMPLE_FIELDS } = require('../lib/session-io.js');
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
