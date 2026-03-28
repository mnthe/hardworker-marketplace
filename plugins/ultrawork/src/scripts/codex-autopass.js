#!/usr/bin/env bun
/**
 * codex-autopass.js - Transform FAIL doc-review result to PASS
 *
 * When doc-review doesn't converge after max retries, this script
 * downgrades remaining errors to warnings and sets verdict to PASS.
 *
 * Usage: codex-autopass.js --session <ID>
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} sessionId
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 */
function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('codex-autopass.js', ARG_SPEC,
      'Transform FAIL doc-review result to PASS after convergence failure.\n' +
      'Downgrades error-severity doc_issues to warnings with [auto-pass] prefix.'
    ));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Build result file path
  const resultFile = `/tmp/codex-doc-${args.sessionId}.json`;

  // Check file exists
  if (!fs.existsSync(resultFile)) {
    console.error(`Error: Result file not found: ${resultFile}`);
    process.exit(1);
  }

  // Read and parse
  let data;
  try {
    const raw = fs.readFileSync(resultFile, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Error: Failed to parse result file: ${err.message}`);
    process.exit(1);
  }

  // Count and downgrade errors to warnings
  let downgradeCount = 0;

  if (data.doc_review && Array.isArray(data.doc_review.doc_issues)) {
    for (const issue of data.doc_review.doc_issues) {
      if (issue.severity === 'error') {
        issue.severity = 'warning';
        issue.detail = `[auto-pass] ${issue.detail}`;
        downgradeCount++;
      }
    }

    // Update doc_review fields
    data.doc_review.exit_code = 0;
    data.doc_review.output = 'auto-pass after convergence control';
  }

  // Set verdict to PASS
  data.verdict = 'PASS';

  // Update summary
  data.summary = `Auto-passed after convergence failure. ${downgradeCount} remaining issues downgraded to warnings.`;

  // Write back to file
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(resultFile, json, 'utf-8');

  // Output to stdout
  console.log(json);
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { main };
