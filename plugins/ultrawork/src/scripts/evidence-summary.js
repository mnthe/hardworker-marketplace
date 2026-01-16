#!/usr/bin/env bun
/**
 * evidence-summary.js - Generate AI-friendly evidence summary
 *
 * Purpose: Create markdown summary of evidence for token-efficient AI consumption.
 * Reads from evidence/log.jsonl and generates evidence/index.md.
 *
 * Usage: evidence-summary.js --session <ID> [--format md|json]
 *
 * Output formats:
 *   md   - Markdown summary (default, AI-friendly)
 *   json - JSON summary (for scripts)
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir, getSessionFile, readSessionField } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').EvidenceEntry} EvidenceEntry
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'], required: true },
  '--format': { key: 'format', aliases: ['-f'], default: 'md' },
  '--save': { key: 'save', aliases: ['-S'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Evidence Reading
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
 * Read task status from tasks directory
 * @param {string} sessionId - Session ID
 * @returns {Object[]} Task summaries
 */
function readTasks(sessionId) {
  const sessionDir = getSessionDir(sessionId);
  const tasksDir = path.join(sessionDir, 'tasks');

  if (!fs.existsSync(tasksDir)) {
    return [];
  }

  const tasks = [];
  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const taskPath = path.join(tasksDir, file);
      const content = fs.readFileSync(taskPath, 'utf-8');
      const task = JSON.parse(content);
      tasks.push({
        id: task.id,
        subject: task.subject,
        status: task.status,
        criteria: task.criteria || [],
        evidence: task.evidence || []
      });
    } catch {
      // Skip invalid task files
    }
  }

  return tasks.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate evidence summary
 * @param {string} sessionId - Session ID
 * @returns {Object} Summary object
 */
function generateSummary(sessionId) {
  const goal = readSessionField(sessionId, 'goal') || 'Unknown';
  const phase = readSessionField(sessionId, 'phase') || 'Unknown';

  const entries = readEvidence(sessionId);
  const tasks = readTasks(sessionId);

  // Count by type
  const byType = {};
  for (const entry of entries) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
  }

  // Get recent entries (last 10)
  const recent = entries.slice(-10).reverse();

  // Task status summary
  const taskStats = {
    total: tasks.length,
    resolved: tasks.filter(t => t.status === 'resolved').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    open: tasks.filter(t => t.status === 'open').length
  };

  return {
    sessionId,
    goal,
    phase,
    evidenceCount: entries.length,
    byType,
    taskStats,
    tasks,
    recent
  };
}

/**
 * Format entry for markdown
 * @param {EvidenceEntry} entry - Evidence entry
 * @returns {string} Formatted line
 */
function formatEntryMd(entry) {
  const time = entry.timestamp?.split('T')[1]?.slice(0, 8) || '';

  switch (entry.type) {
    case 'command_execution':
      return `- ${time} \`${entry.command?.slice(0, 40)}...\` → exit ${entry.exit_code}`;
    case 'test_result':
      const status = entry.passed ? '✓' : '✗';
      return `- ${time} ${status} ${entry.framework}: ${entry.output_preview?.slice(0, 50) || 'N/A'}`;
    case 'file_operation':
      return `- ${time} ${entry.operation?.toUpperCase()} \`${entry.path}\``;
    case 'agent_completed':
      return `- ${time} Agent ${entry.agent_id} completed (task: ${entry.task_id || 'N/A'})`;
    default:
      return `- ${time} ${entry.type}`;
  }
}

/**
 * Generate markdown summary
 * @param {Object} summary - Summary object
 * @returns {string} Markdown content
 */
function generateMarkdown(summary) {
  const lines = [];

  lines.push(`# Evidence Summary`);
  lines.push('');
  lines.push(`**Session**: ${summary.sessionId}`);
  lines.push(`**Phase**: ${summary.phase}`);
  lines.push(`**Goal**: ${summary.goal}`);
  lines.push('');

  // Task status
  lines.push('## Task Status');
  lines.push('');
  lines.push(`| Total | Resolved | In Progress | Open |`);
  lines.push(`|-------|----------|-------------|------|`);
  lines.push(`| ${summary.taskStats.total} | ${summary.taskStats.resolved} ✓ | ${summary.taskStats.in_progress} → | ${summary.taskStats.open} |`);
  lines.push('');

  // Task details
  if (summary.tasks.length > 0) {
    lines.push('### Tasks');
    lines.push('');
    for (const task of summary.tasks) {
      const statusIcon = task.status === 'resolved' ? '✓' : task.status === 'in_progress' ? '→' : '○';
      const criteriaCount = task.criteria.length;
      const evidenceCount = task.evidence.length;
      lines.push(`- [${statusIcon}] **${task.id}**: ${task.subject} (${evidenceCount}/${criteriaCount} evidence)`);
    }
    lines.push('');
  }

  // Evidence by type
  lines.push('## Evidence Summary');
  lines.push('');
  lines.push(`Total: ${summary.evidenceCount} entries`);
  lines.push('');
  for (const [type, count] of Object.entries(summary.byType)) {
    lines.push(`- ${type}: ${count}`);
  }
  lines.push('');

  // Recent activity
  if (summary.recent.length > 0) {
    lines.push('## Recent Activity');
    lines.push('');
    for (const entry of summary.recent) {
      lines.push(formatEntryMd(entry));
    }
    lines.push('');
  }

  // Navigation
  lines.push('---');
  lines.push('');
  lines.push('*For full evidence log, run `/ultrawork-evidence`*');

  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('evidence-summary.js', ARG_SPEC,
      'Generate AI-friendly evidence summary.\n' +
      'Creates markdown overview of evidence for token-efficient consumption.'
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

    // Generate summary
    const summary = generateSummary(args.sessionId);

    // Output in requested format
    if (args.format === 'json') {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      const markdown = generateMarkdown(summary);

      if (args.save) {
        // Save to evidence/index.md
        const sessionDir = getSessionDir(args.sessionId);
        const evidenceDir = path.join(sessionDir, 'evidence');
        if (!fs.existsSync(evidenceDir)) {
          fs.mkdirSync(evidenceDir, { recursive: true });
        }
        const indexFile = path.join(evidenceDir, 'index.md');
        fs.writeFileSync(indexFile, markdown, 'utf-8');
        console.log(`Saved to: ${indexFile}`);
      } else {
        console.log(markdown);
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

module.exports = { generateSummary, generateMarkdown, readEvidence, readTasks };
