#!/usr/bin/env bun
/**
 * task-summary.js - Generate AI-friendly task summary
 *
 * Purpose: Create markdown summary/view of tasks for token-efficient AI consumption.
 * Can generate: overview (all tasks), single task detail, or save markdown files.
 *
 * Usage:
 *   task-summary.js --session <ID>                    # Overview of all tasks
 *   task-summary.js --session <ID> --task <TASK_ID>   # Single task detail
 *   task-summary.js --session <ID> --save             # Save tasks/summary.md
 *
 * Output: Markdown format optimized for AI agents
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir, getSessionFile, readSessionField } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', alias: '-s', required: true },
  '--task': { key: 'taskId', alias: '-t' },
  '--save': { key: 'save', alias: '-S', flag: true },
  '--format': { key: 'format', alias: '-f', default: 'md' },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Task Reading
// ============================================================================

/**
 * Read all tasks from tasks directory
 * @param {string} sessionId - Session ID
 * @returns {Task[]} All tasks
 */
function readAllTasks(sessionId) {
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
      tasks.push(task);
    } catch {
      // Skip invalid task files
    }
  }

  // Sort by ID (numeric if possible)
  return tasks.sort((a, b) => {
    const aNum = parseInt(a.id, 10);
    const bNum = parseInt(b.id, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Read single task by ID
 * @param {string} sessionId - Session ID
 * @param {string} taskId - Task ID
 * @returns {Task | null} Task or null
 */
function readTask(sessionId, taskId) {
  const sessionDir = getSessionDir(sessionId);
  const taskPath = path.join(sessionDir, 'tasks', `${taskId}.json`);

  if (!fs.existsSync(taskPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(taskPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ============================================================================
// Markdown Generation
// ============================================================================

/**
 * Generate overview markdown for all tasks
 * @param {string} sessionId - Session ID
 * @param {Task[]} tasks - All tasks
 * @returns {string} Markdown content
 */
function generateOverviewMd(sessionId, tasks) {
  const goal = readSessionField(sessionId, 'goal') || 'Unknown';
  const phase = readSessionField(sessionId, 'phase') || 'Unknown';

  const lines = [];

  lines.push('# Task Overview');
  lines.push('');
  lines.push(`**Session**: ${sessionId}`);
  lines.push(`**Phase**: ${phase}`);
  lines.push(`**Goal**: ${goal}`);
  lines.push('');

  // Statistics
  const stats = {
    total: tasks.length,
    resolved: tasks.filter(t => t.status === 'resolved').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    open: tasks.filter(t => t.status === 'open').length,
    blocked: tasks.filter(t => t.status === 'blocked').length
  };

  lines.push('## Status');
  lines.push('');
  lines.push(`- Total: ${stats.total}`);
  lines.push(`- ✓ Resolved: ${stats.resolved}`);
  lines.push(`- → In Progress: ${stats.in_progress}`);
  lines.push(`- ○ Open: ${stats.open}`);
  if (stats.blocked > 0) {
    lines.push(`- ⊘ Blocked: ${stats.blocked}`);
  }
  lines.push('');

  // Task list
  lines.push('## Tasks');
  lines.push('');

  if (tasks.length === 0) {
    lines.push('(no tasks yet)');
  } else {
    for (const task of tasks) {
      const statusIcon = getStatusIcon(task.status);
      const complexityBadge = task.complexity === 'complex' ? ' [complex]' : '';
      const criteriaProgress = `${(task.evidence || []).length}/${(task.criteria || []).length}`;

      lines.push(`### ${statusIcon} Task ${task.id}: ${task.subject}${complexityBadge}`);
      lines.push('');
      lines.push(`**Status**: ${task.status} | **Criteria**: ${criteriaProgress}`);

      if (task.blocked_by && task.blocked_by.length > 0) {
        lines.push(`**Blocked by**: ${task.blocked_by.join(', ')}`);
      }

      if (task.description) {
        lines.push('');
        lines.push(task.description);
      }

      lines.push('');
    }
  }

  // Navigation hint
  lines.push('---');
  lines.push('');
  lines.push('*Use `task-summary.js --task <ID>` for detailed view*');

  return lines.join('\n');
}

/**
 * Generate detailed markdown for single task
 * @param {Task} task - Task object
 * @returns {string} Markdown content
 */
function generateTaskDetailMd(task) {
  const lines = [];

  const statusIcon = getStatusIcon(task.status);

  lines.push(`# ${statusIcon} Task ${task.id}: ${task.subject}`);
  lines.push('');

  // Metadata
  lines.push('## Details');
  lines.push('');
  lines.push(`- **Status**: ${task.status}`);
  lines.push(`- **Complexity**: ${task.complexity || 'standard'}`);
  if (task.approach) {
    lines.push(`- **Approach**: ${task.approach}`);
  }
  if (task.blocked_by && task.blocked_by.length > 0) {
    lines.push(`- **Blocked by**: ${task.blocked_by.join(', ')}`);
  }
  lines.push('');

  // Description
  if (task.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(task.description);
    lines.push('');
  }

  // Criteria
  if (task.criteria && task.criteria.length > 0) {
    lines.push('## Success Criteria');
    lines.push('');
    for (const criterion of task.criteria) {
      // Check if criterion has matching evidence
      const hasEvidence = task.evidence?.some(e =>
        typeof e === 'string' ? false : e.criterion === criterion
      );
      const checkmark = hasEvidence ? '✓' : '○';
      lines.push(`- [${checkmark}] ${criterion}`);
    }
    lines.push('');
  }

  // Evidence
  if (task.evidence && task.evidence.length > 0) {
    lines.push('## Collected Evidence');
    lines.push('');
    for (const evidence of task.evidence) {
      if (typeof evidence === 'string') {
        lines.push(`- ${evidence}`);
      } else if (evidence.description) {
        lines.push(`- ${evidence.description}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get status icon
 * @param {string} status - Task status
 * @returns {string} Status icon
 */
function getStatusIcon(status) {
  switch (status) {
    case 'resolved': return '✓';
    case 'in_progress': return '→';
    case 'blocked': return '⊘';
    default: return '○';
  }
}

// ============================================================================
// Main
// ============================================================================

function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('task-summary.js', ARG_SPEC,
      'Generate AI-friendly task summary.\n' +
      'Creates markdown overview or detail view of tasks.'
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

    let markdown;

    if (args.taskId) {
      // Single task detail
      const task = readTask(args.sessionId, args.taskId);
      if (!task) {
        console.error(`Error: Task ${args.taskId} not found`);
        process.exit(1);
      }
      markdown = generateTaskDetailMd(task);
    } else {
      // Overview of all tasks
      const tasks = readAllTasks(args.sessionId);
      markdown = generateOverviewMd(args.sessionId, tasks);
    }

    // Output
    if (args.format === 'json') {
      // JSON output for scripts
      if (args.taskId) {
        const task = readTask(args.sessionId, args.taskId);
        console.log(JSON.stringify(task, null, 2));
      } else {
        const tasks = readAllTasks(args.sessionId);
        console.log(JSON.stringify(tasks, null, 2));
      }
    } else {
      if (args.save) {
        // Save to tasks/summary.md
        const sessionDir = getSessionDir(args.sessionId);
        const tasksDir = path.join(sessionDir, 'tasks');
        if (!fs.existsSync(tasksDir)) {
          fs.mkdirSync(tasksDir, { recursive: true });
        }
        const summaryFile = path.join(tasksDir, 'summary.md');
        fs.writeFileSync(summaryFile, markdown, 'utf-8');
        console.log(`Saved to: ${summaryFile}`);
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

module.exports = { readAllTasks, readTask, generateOverviewMd, generateTaskDetailMd };
