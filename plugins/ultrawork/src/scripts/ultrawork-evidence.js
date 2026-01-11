#!/usr/bin/env node

/**
 * Ultrawork Evidence Script
 * Lists evidence_log entries with formatting
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir, getSessionFile, readSession } = require('../lib/session-utils.js');

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').EvidenceEntry} EvidenceEntry
 */

/**
 * Parse command-line arguments
 * @returns {{sessionId?: string, help: boolean}} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let sessionId;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-h':
      case '--help':
        help = true;
        break;
      case '--session':
        if (i + 1 < args.length) {
          sessionId = args[i + 1];
          i++; // Skip next argument
        } else {
          console.error('❌ Error: --session requires a session ID argument');
          process.exit(1);
        }
        break;
    }
  }

  return { sessionId, help };
}

// ============================================================================
// Help Text
// ============================================================================

/**
 * Show help message
 * @returns {void}
 */
function showHelp() {
  console.log(`
═══════════════════════════════════════════════════════════
 ULTRAWORK-EVIDENCE - View Collected Evidence
═══════════════════════════════════════════════════════════

USAGE:
  ultrawork-evidence --session <id>

OPTIONS:
  --session <id>   Session ID (required, provided by AI)
  -h, --help       Show this help message

═══════════════════════════════════════════════════════════
`);
}

// ============================================================================
// Format Evidence Entry
// ============================================================================

/**
 * Format evidence entry for display
 * @param {EvidenceEntry} entry - Evidence entry to format
 * @param {number} index - Entry index
 * @returns {string} Formatted entry
 */
function formatEvidenceEntry(entry, index) {
  const lines = [];
  lines.push(`[${index + 1}] ${entry.type.toUpperCase()}`);
  lines.push(`    Timestamp: ${entry.timestamp}`);

  switch (entry.type) {
    case 'command_execution':
      lines.push(`    Command: ${entry.command}`);
      lines.push(`    Exit Code: ${entry.exit_code}`);
      if (entry.output_preview) {
        lines.push(`    Output: ${entry.output_preview.substring(0, 100)}...`);
      }
      break;

    case 'file_operation':
      lines.push(`    Operation: ${entry.operation}`);
      lines.push(`    Path: ${entry.path}`);
      break;

    case 'agent_completed':
      lines.push(`    Agent ID: ${entry.agent_id}`);
      if (entry.task_id) {
        lines.push(`    Task ID: ${entry.task_id}`);
      }
      break;

    case 'test_result':
      lines.push(`    Passed: ${entry.passed}`);
      lines.push(`    Framework: ${entry.framework}`);
      if (entry.output_preview) {
        lines.push(`    Output: ${entry.output_preview.substring(0, 100)}...`);
      }
      break;

    default:
      lines.push(`    Data: ${JSON.stringify(entry)}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Show Evidence Log
// ============================================================================

/**
 * Show evidence log for session
 * @param {string} sessionId - Session ID
 * @returns {void}
 */
function showEvidenceLog(sessionId) {
  const sessionFile = getSessionFile(sessionId);

  if (!fs.existsSync(sessionFile)) {
    console.error(`❌ Session ${sessionId} not found.`);
    process.exit(1);
  }

  /** @type {Session} */
  let session;
  try {
    session = readSession(sessionId);
  } catch (error) {
    console.error(`❌ Failed to read session: ${error}`);
    process.exit(1);
  }

  const sessionDir = getSessionDir(sessionId);

  // Output header
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' ULTRAWORK EVIDENCE LOG');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(` Session ID: ${session.session_id}`);
  console.log(` Goal: ${session.goal}`);
  console.log(` Phase: ${session.phase}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log(' EVIDENCE');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');

  // Display evidence_log entries
  if (!session.evidence_log || session.evidence_log.length === 0) {
    console.log('  (no evidence collected yet)');
  } else {
    session.evidence_log.forEach((entry, index) => {
      console.log(formatEvidenceEntry(entry, index));
      console.log('');
    });

    console.log('───────────────────────────────────────────────────────────');
    console.log(` Total Evidence Items: ${session.evidence_log.length}`);
  }

  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log(' SESSION DIRECTORY');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  console.log(` ${sessionDir}/`);
  console.log('   ├── session.json');
  console.log('   ├── context.json');
  console.log('   ├── exploration/');
  console.log('   └── tasks/');
  console.log('');
  console.log(' To view full session data:');
  console.log(`   cat "${sessionFile}" | jq '.'`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  const { sessionId, help } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  if (!sessionId) {
    console.error('❌ Error: --session is required');
    process.exit(1);
  }

  showEvidenceLog(sessionId);
}

main();
