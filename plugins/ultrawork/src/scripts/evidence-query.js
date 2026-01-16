#!/usr/bin/env bun
/**
 * evidence-query.js - Query evidence with filters
 *
 * Purpose: Allow agents to query specific subsets of evidence efficiently.
 * Supports filtering by: type, time range, task (via task evidence), search pattern.
 *
 * Usage:
 *   evidence-query.js --session <ID>                      # All evidence (compact)
 *   evidence-query.js --session <ID> --type test_result   # Filter by type
 *   evidence-query.js --session <ID> --last 5             # Last N entries
 *   evidence-query.js --session <ID> --search "npm test"  # Search in content
 *   evidence-query.js --session <ID> --task 1             # Evidence for task 1
 *
 * Output: Markdown by default (token-efficient), JSON with --format json
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir, getSessionFile } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').EvidenceEntry} EvidenceEntry
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'], required: true },
  '--type': { key: 'type', aliases: ['-T'] },
  '--last': { key: 'last', aliases: ['-l'] },
  '--search': { key: 'search', aliases: ['-q'] },
  '--id': { key: 'taskId', aliases: ['-t', '--task', '--task-id'] },
  '--format': { key: 'format', aliases: ['-f'], default: 'md' },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Evidence Reading & Filtering
// ============================================================================

/**
 * Read evidence entries from JSONL file
 * @param {string} sessionId - Session ID
 * @returns {EvidenceEntry[]} Evidence entries
 */
function readEvidence(sessionId) {
  const sessionDir = getSessionDir(sessionId);
  const evidenceLog = path.join(sessionDir, 'evidence', 'log.jsonl');

  if (!fs.existsSync(evidenceLog)) {
    return [];
  }

  const content = fs.readFileSync(evidenceLog, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);
  return lines.map(line => JSON.parse(line));
}

/**
 * Read task evidence from task JSON file
 * @param {string} sessionId - Session ID
 * @param {string} taskId - Task ID
 * @returns {string[]} Task-specific evidence strings
 */
function readTaskEvidence(sessionId, taskId) {
  const sessionDir = getSessionDir(sessionId);
  const taskPath = path.join(sessionDir, 'tasks', `${taskId}.json`);

  if (!fs.existsSync(taskPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(taskPath, 'utf-8');
    const task = JSON.parse(content);
    return task.evidence || [];
  } catch {
    return [];
  }
}

/**
 * Filter evidence entries
 * @param {EvidenceEntry[]} entries - All entries
 * @param {Object} filters - Filter options
 * @returns {EvidenceEntry[]} Filtered entries
 */
function filterEvidence(entries, filters) {
  let result = [...entries];

  // Filter by type
  if (filters.type) {
    result = result.filter(e => e.type === filters.type);
  }

  // Filter by search pattern (in command, path, output_preview)
  if (filters.search) {
    const pattern = filters.search.toLowerCase();
    result = result.filter(e => {
      const searchable = [
        e.command,
        e.path,
        e.output_preview,
        e.type
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(pattern);
    });
  }

  // Take last N entries
  if (filters.last) {
    const n = parseInt(filters.last, 10);
    if (!isNaN(n) && n > 0) {
      result = result.slice(-n);
    }
  }

  return result;
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format single evidence entry for markdown
 * @param {EvidenceEntry} entry - Evidence entry
 * @param {number} index - Entry index
 * @returns {string} Formatted markdown
 */
function formatEntryMd(entry, index) {
  const time = entry.timestamp?.split('T')[1]?.slice(0, 8) || '';
  const lines = [];

  lines.push(`### [${index + 1}] ${entry.type.toUpperCase()} @ ${time}`);

  switch (entry.type) {
    case 'command_execution':
      lines.push(`- **Command**: \`${entry.command}\``);
      lines.push(`- **Exit**: ${entry.exit_code}`);
      if (entry.output_preview) {
        lines.push(`- **Output**:`);
        lines.push('```');
        lines.push(entry.output_preview.slice(0, 300));
        lines.push('```');
      }
      break;

    case 'test_result':
      const status = entry.passed ? '✓ PASSED' : '✗ FAILED';
      lines.push(`- **Status**: ${status}`);
      lines.push(`- **Framework**: ${entry.framework}`);
      if (entry.output_preview) {
        lines.push(`- **Summary**: ${entry.output_preview}`);
      }
      break;

    case 'file_operation':
      lines.push(`- **Operation**: ${entry.operation?.toUpperCase()}`);
      lines.push(`- **Path**: \`${entry.path}\``);
      break;

    case 'agent_completed':
      lines.push(`- **Agent**: ${entry.agent_id}`);
      if (entry.task_id) {
        lines.push(`- **Task**: ${entry.task_id}`);
      }
      if (entry.summary) {
        lines.push(`- **Summary**: ${entry.summary}`);
      }
      break;

    default:
      lines.push(`- **Data**: ${JSON.stringify(entry)}`);
  }

  return lines.join('\n');
}

/**
 * Format evidence list as markdown
 * @param {EvidenceEntry[]} entries - Filtered entries
 * @param {Object} filters - Applied filters
 * @returns {string} Markdown content
 */
function formatAsMd(entries, filters) {
  const lines = [];

  // Header with filter info
  lines.push('# Evidence Query Results');
  lines.push('');

  const filterParts = [];
  if (filters.type) filterParts.push(`type=${filters.type}`);
  if (filters.search) filterParts.push(`search="${filters.search}"`);
  if (filters.last) filterParts.push(`last=${filters.last}`);
  if (filters.taskId) filterParts.push(`task=${filters.taskId}`);

  if (filterParts.length > 0) {
    lines.push(`**Filters**: ${filterParts.join(', ')}`);
  }
  lines.push(`**Results**: ${entries.length} entries`);
  lines.push('');

  if (entries.length === 0) {
    lines.push('(no matching evidence)');
  } else {
    for (let i = 0; i < entries.length; i++) {
      lines.push(formatEntryMd(entries[i], i));
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format task evidence as markdown
 * @param {string} taskId - Task ID
 * @param {string[]} evidence - Task evidence strings
 * @returns {string} Markdown content
 */
function formatTaskEvidenceMd(taskId, evidence) {
  const lines = [];

  lines.push(`# Evidence for Task ${taskId}`);
  lines.push('');
  lines.push(`**Count**: ${evidence.length} entries`);
  lines.push('');

  if (evidence.length === 0) {
    lines.push('(no evidence collected yet)');
  } else {
    for (let i = 0; i < evidence.length; i++) {
      const e = evidence[i];
      if (typeof e === 'string') {
        lines.push(`${i + 1}. ${e}`);
      } else {
        lines.push(`${i + 1}. ${e.description || JSON.stringify(e)}`);
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('evidence-query.js', ARG_SPEC,
      'Query evidence with filters.\n' +
      'Supports filtering by type, time, search pattern, or task.\n\n' +
      'Evidence types: command_execution, test_result, file_operation, agent_completed'
    ));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  try {
    // Validate session exists
    const sessionFile = getSessionFile(args.sessionId);
    if (!fs.existsSync(sessionFile)) {
      console.error(`Error: Session ${args.sessionId} not found`);
      process.exit(1);
    }

    // Task-specific query
    if (args.taskId) {
      const taskEvidence = readTaskEvidence(args.sessionId, args.taskId);

      if (args.format === 'json') {
        console.log(JSON.stringify(taskEvidence, null, 2));
      } else {
        console.log(formatTaskEvidenceMd(args.taskId, taskEvidence));
      }
      process.exit(0);
    }

    // General evidence query
    const entries = readEvidence(args.sessionId);
    const filtered = filterEvidence(entries, {
      type: args.type,
      search: args.search,
      last: args.last
    });

    if (args.format === 'json') {
      console.log(JSON.stringify(filtered, null, 2));
    } else {
      console.log(formatAsMd(filtered, {
        type: args.type,
        search: args.search,
        last: args.last
      }));
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

module.exports = { readEvidence, readTaskEvidence, filterEvidence };
