#!/usr/bin/env node
/**
 * task-list.ts - List tasks with filtering
 * Usage: task-list.ts --session <ID> [--status open|resolved] [--format json|table]
 *
 * TypeScript port of task-list.sh
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSessionDir } from '../lib/session-utils';
import { Task } from '../lib/types';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliArgs {
  session?: string;
  status?: string;
  format: 'json' | 'table';
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    format: 'table',
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--session':
        args.session = argv[++i];
        break;
      case '--status':
        args.status = argv[++i];
        break;
      case '--format':
        args.format = argv[++i] as 'json' | 'table';
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        // Skip unknown args
        break;
    }
  }

  return args;
}

// ============================================================================
// Task Collection
// ============================================================================

interface TaskSummary {
  id: string;
  status: string;
  subject: string;
  blocked_by: string;
  complexity: string;
}

function collectTasks(tasksDir: string, statusFilter?: string): TaskSummary[] {
  if (!fs.existsSync(tasksDir)) {
    throw new Error('No tasks directory found');
  }

  const tasks: TaskSummary[] = [];
  const files = fs.readdirSync(tasksDir);

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const taskFile = path.join(tasksDir, file);
    const id = path.basename(file, '.json');

    try {
      const content = fs.readFileSync(taskFile, 'utf-8');
      const taskData = JSON.parse(content) as any;

      const status = taskData.status || 'open';
      const subject = taskData.subject || 'Unknown';
      const blocked_by = (taskData.blockedBy || []).join(',');
      const complexity = taskData.complexity || 'standard';

      // Apply status filter
      if (statusFilter && status !== statusFilter) {
        continue;
      }

      tasks.push({
        id,
        status,
        subject,
        blocked_by,
        complexity,
      });
    } catch (err) {
      // Skip invalid task files
      console.error(`Warning: Failed to parse ${file}: ${err}`, { file: process.stderr });
      continue;
    }
  }

  return tasks;
}

// ============================================================================
// Output Formatting
// ============================================================================

function outputJson(tasks: TaskSummary[]): void {
  const output = tasks.map((t) => ({
    id: t.id,
    status: t.status,
    subject: t.subject,
    blockedBy: t.blocked_by,
    complexity: t.complexity,
  }));

  console.log(JSON.stringify(output, null, 2));
}

function outputTable(tasks: TaskSummary[]): void {
  console.log('ID|STATUS|SUBJECT|BLOCKED_BY|COMPLEXITY');
  for (const task of tasks) {
    console.log(
      `${task.id}|${task.status}|${task.subject}|${task.blocked_by}|${task.complexity}`
    );
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

function main(): void {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log('Usage: task-list.ts --session <ID> [--status open|resolved] [--format json|table]');
    process.exit(0);
  }

  // Validate required args
  if (!args.session) {
    console.error('Error: --session required');
    process.exit(1);
  }

  try {
    // Get session directory
    const sessionDir = getSessionDir(args.session);
    const tasksDir = path.join(sessionDir, 'tasks');

    // Collect tasks
    const tasks = collectTasks(tasksDir, args.status);

    // Output in requested format
    if (args.format === 'json') {
      outputJson(tasks);
    } else {
      outputTable(tasks);
    }

    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }
}

// Run if invoked directly
if (require.main === module) {
  main();
}

export { collectTasks, outputJson, outputTable };
