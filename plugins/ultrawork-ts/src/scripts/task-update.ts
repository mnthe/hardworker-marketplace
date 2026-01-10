#!/usr/bin/env node
/**
 * task-update.ts - Update task status and evidence
 * TypeScript port of task-update.sh
 *
 * Usage: task-update.ts --session <ID> --id <task_id> [--status open|resolved] [--add-evidence "..."]
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSessionDir, resolveSessionId } from '../lib/session-utils';
import { acquireLock, releaseLock } from '../lib/file-lock';
import { Task, TaskStatus } from '../lib/types';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface ParsedArgs {
  session?: string;
  id?: string;
  status?: TaskStatus;
  addEvidence?: string;
  help?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--session':
        args.session = next;
        i++;
        break;
      case '--id':
        args.id = next;
        i++;
        break;
      case '--status':
        args.status = next as TaskStatus;
        i++;
        break;
      case '--add-evidence':
        args.addEvidence = next;
        i++;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
    }
  }

  return args;
}

// ============================================================================
// Main Logic
// ============================================================================

async function main() {
  const args = parseArgs(process.argv);

  // Handle help
  if (args.help) {
    console.log('Usage: task-update.ts --session <ID> --id <task_id> [--status open|resolved] [--add-evidence "..."]');
    process.exit(0);
  }

  // Validate required arguments
  if (!args.session || !args.id) {
    console.error('Error: --session and --id required');
    process.exit(1);
  }

  try {
    // Validate session exists
    resolveSessionId(args.session);

    // Get task file path
    const sessionDir = getSessionDir(args.session);
    const taskFile = path.join(sessionDir, 'tasks', `${args.id}.json`);

    // Check if task exists
    if (!fs.existsSync(taskFile)) {
      console.error(`Error: Task ${args.id} not found`);
      process.exit(1);
    }

    // Acquire lock
    const acquired = await acquireLock(taskFile);
    if (!acquired) {
      console.error(`Error: Failed to acquire lock for task ${args.id}`);
      process.exit(1);
    }

    try {
      // Read current task
      const content = fs.readFileSync(taskFile, 'utf-8');
      const task = JSON.parse(content) as Task;

      // Update status if provided
      if (args.status) {
        task.status = args.status;
      }

      // Add evidence if provided
      if (args.addEvidence) {
        // Match bash behavior: add as string to evidence array
        // Note: This matches the bash implementation even though the type
        // definition suggests evidence should be TaskEvidence objects
        (task.evidence as unknown as string[]).push(args.addEvidence);
      }

      // Update timestamp
      task.updated_at = new Date().toISOString();

      // Write back atomically
      const tmpFile = `${taskFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(task, null, 2), 'utf-8');
      fs.renameSync(tmpFile, taskFile);

      // Output success message and updated task
      console.log(`OK: Task ${args.id} updated`);
      console.log(JSON.stringify(task, null, 2));
    } finally {
      releaseLock(taskFile);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Unknown error occurred');
    }
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
