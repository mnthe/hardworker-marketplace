#!/usr/bin/env node
/**
 * task-create.ts - Create new task JSON file
 * CLI to create task files with validation
 *
 * Usage: task-create.ts --session <ID> --id <id> --subject "..." [options]
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSessionDir } from '../lib/session-utils';
import { Task, Complexity } from '../lib/types';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliArgs {
  session?: string;
  id?: string;
  subject?: string;
  description?: string;
  complexity?: Complexity;
  criteria?: string;
  blockedBy?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--session':
        args.session = argv[++i];
        break;
      case '--id':
        args.id = argv[++i];
        break;
      case '--subject':
        args.subject = argv[++i];
        break;
      case '--description':
        args.description = argv[++i];
        break;
      case '--complexity':
        args.complexity = argv[++i] as Complexity;
        break;
      case '--criteria':
        args.criteria = argv[++i];
        break;
      case '--blocked-by':
        args.blockedBy = argv[++i];
        break;
      case '-h':
      case '--help':
        console.log('Usage: task-create.ts --session <ID> --id <id> --subject "..." [options]');
        console.log('Options:');
        console.log('  --description "..."       Task description (defaults to subject)');
        console.log('  --complexity simple|standard|complex  (default: standard)');
        console.log('  --criteria "..."          Pipe-separated criteria');
        console.log('  --blocked-by "1,2"        Comma-separated task IDs');
        process.exit(0);
        break;
    }
  }

  return args;
}

// ============================================================================
// Validation
// ============================================================================

function validateArgs(args: CliArgs): void {
  if (!args.session) {
    console.error('Error: --session required');
    process.exit(1);
  }

  if (!args.id) {
    console.error('Error: --id required');
    process.exit(1);
  }

  if (!args.subject) {
    console.error('Error: --subject required');
    process.exit(1);
  }

  // Validate complexity if provided
  if (args.complexity) {
    const validComplexities: Complexity[] = ['simple', 'standard', 'complex'];
    if (!validComplexities.includes(args.complexity)) {
      console.error(`Error: Invalid complexity "${args.complexity}". Must be: simple, standard, or complex`);
      process.exit(1);
    }
  }
}

// ============================================================================
// Task Creation
// ============================================================================

function parseCriteria(criteriaStr: string): string[] {
  if (!criteriaStr || criteriaStr.trim() === '') {
    return [];
  }

  return criteriaStr
    .split('|')
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

function parseBlockedBy(blockedByStr: string): string[] {
  if (!blockedByStr || blockedByStr.trim() === '') {
    return [];
  }

  return blockedByStr
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

function createTask(args: CliArgs): void {
  const sessionDir = getSessionDir(args.session!);
  const tasksDir = path.join(sessionDir, 'tasks');
  const taskFile = path.join(tasksDir, `${args.id}.json`);

  // Create tasks directory if needed
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  // Check if task already exists
  if (fs.existsSync(taskFile)) {
    console.error(`Error: Task ${args.id} already exists`);
    process.exit(1);
  }

  // Build task object
  const now = new Date().toISOString();
  const task: Task = {
    id: args.id!,
    subject: args.subject!,
    description: args.description || args.subject!,
    complexity: args.complexity || 'standard',
    status: 'open',
    blocked_by: parseBlockedBy(args.blockedBy || ''),
    criteria: parseCriteria(args.criteria || ''),
    evidence: [],
    created_at: now,
    updated_at: now
  };

  // Write task JSON
  fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf-8');

  // Output success message and task JSON
  console.log(`OK: Task ${args.id} created`);
  console.log(JSON.stringify(task, null, 2));
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    validateArgs(args);
    createTask(args);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Unknown error occurred');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
