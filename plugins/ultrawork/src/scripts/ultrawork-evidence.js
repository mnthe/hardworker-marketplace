#!/usr/bin/env bun

/**
 * Ultrawork Evidence Script
 * Lists evidence_log entries with formatting
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir, getSessionFile, readSessionField } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').EvidenceEntry} EvidenceEntry
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', alias: '-s', required: true },
  '--help': { key: 'help', alias: '-h', flag: true }
};

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

  // Read session fields (optimized: only reads needed fields)
  let goal, phase;
  try {
    goal = readSessionField(sessionId, 'goal') || 'Unknown';
    phase = readSessionField(sessionId, 'phase') || 'Unknown';
  } catch (error) {
    console.error(`❌ Failed to read session: ${error}`);
    process.exit(1);
  }

  const sessionDir = getSessionDir(sessionId);
  const evidenceLog = path.join(sessionDir, 'evidence', 'log.jsonl');

  // Output header
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' ULTRAWORK EVIDENCE LOG');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(` Session ID: ${sessionId}`);
  console.log(` Goal: ${goal}`);
  console.log(` Phase: ${phase}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log(' EVIDENCE');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');

  // Read evidence from JSONL file
  /** @type {EvidenceEntry[]} */
  let entries = [];
  if (fs.existsSync(evidenceLog)) {
    const content = fs.readFileSync(evidenceLog, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    entries = lines.map(line => JSON.parse(line));
  }

  // Display evidence entries
  if (entries.length === 0) {
    console.log('  (no evidence collected yet)');
  } else {
    entries.forEach((entry, index) => {
      console.log(formatEvidenceEntry(entry, index));
      console.log('');
    });

    console.log('───────────────────────────────────────────────────────────');
    console.log(` Total Evidence Items: ${entries.length}`);
  }

  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log(' SESSION DIRECTORY');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  console.log(` ${sessionDir}/`);
  console.log('   ├── session.json');
  console.log('   ├── context.json');
  console.log('   ├── evidence/');
  console.log('   │   └── log.jsonl');
  console.log('   ├── exploration/');
  console.log('   └── tasks/');
  console.log('');
  console.log(' To view raw evidence:');
  console.log(`   cat "${evidenceLog}"`);
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
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('ultrawork-evidence.js', ARG_SPEC, 'View collected evidence log from ultrawork session'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  const { sessionId } = args;

  showEvidenceLog(sessionId);
}

main();
