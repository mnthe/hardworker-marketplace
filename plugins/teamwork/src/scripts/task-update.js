#!/usr/bin/env bun
/**
 * task-update.js - Update teamwork task
 *
 * Usage: task-update.js --project <name> --team <name> --id <task_id> [--status open|resolved] [--add-evidence "..."] [--owner <id>] [--release]
 */

const fs = require('fs');
const { acquireLock, releaseLock } = require('../lib/file-lock.js');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getTaskFile } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').TaskStatus} TaskStatus
 */

/**
 * @typedef {Object} ParsedArgs
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [id]
 * @property {TaskStatus} [status]
 * @property {string} [addEvidence]
 * @property {string} [evidenceType]
 * @property {string} [command]
 * @property {string} [output]
 * @property {string} [exitCode]
 * @property {string} [path]
 * @property {string} [action]
 * @property {string} [owner]
 * @property {boolean} [release]
 * @property {boolean} [help]
 */

// ============================================================================
// Main Logic
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--id': { key: 'id', aliases: ['-i', '--task', '--task-id'], required: true },
  '--status': { key: 'status', aliases: ['-s'] },
  '--add-evidence': { key: 'addEvidence', aliases: ['-e'] },
  '--evidence-type': { key: 'evidenceType' },
  '--command': { key: 'command' },
  '--output': { key: 'output' },
  '--exit-code': { key: 'exitCode' },
  '--path': { key: 'path' },
  '--action': { key: 'action' },
  '--owner': { key: 'owner', aliases: ['-o'] },
  '--release': { key: 'release', aliases: ['-r'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('task-update.js', ARG_SPEC, 'Update teamwork task status, evidence, or ownership'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  try {
    // Get task file path
    const taskFile = getTaskFile(args.project, args.team, args.id);

    // Check if task exists
    if (!fs.existsSync(taskFile)) {
      console.error(`Error: Task ${args.id} not found`);
      process.exit(1);
    }

    // Get owner for lock identification
    const owner = args.owner || process.env.CLAUDE_SESSION_ID;

    // Acquire lock with owner identification
    const acquired = await acquireLock(taskFile, owner);
    if (!acquired) {
      console.error(`Error: Failed to acquire lock for task ${args.id}`);
      process.exit(1);
    }

    try {
      // Read current task
      const content = fs.readFileSync(taskFile, 'utf-8');
      /** @type {Task} */
      const task = JSON.parse(content);

      // Update status if provided
      if (args.status) {
        task.status = args.status;

        // Set completed_at when marking as resolved
        if (args.status === 'resolved') {
          task.completed_at = new Date().toISOString();
        }
      }

      // Add evidence if provided
      if (args.addEvidence) {
        // Simple string evidence (backward compatibility)
        task.evidence.push(args.addEvidence);
      } else if (args.evidenceType) {
        // Structured evidence
        const evidence = {
          type: args.evidenceType,
          timestamp: new Date().toISOString()
        };

        // Add type-specific fields
        if (args.evidenceType === 'command') {
          if (args.command) evidence.command = args.command;
          if (args.output) evidence.output = args.output;
          if (args.exitCode !== undefined) evidence.exit_code = parseInt(args.exitCode, 10);
        } else if (args.evidenceType === 'file') {
          if (args.path) evidence.path = args.path;
          if (args.action) evidence.action = args.action;
        } else if (args.evidenceType === 'test') {
          if (args.command) evidence.command = args.command;
          if (args.output) evidence.output = args.output;
          if (args.exitCode !== undefined) evidence.exit_code = parseInt(args.exitCode, 10);
        } else if (args.evidenceType === 'manual') {
          if (args.output) evidence.description = args.output;
        }

        task.evidence.push(evidence);
      }

      // Update owner if provided
      if (args.owner !== undefined) {
        task.claimed_by = args.owner;
      }

      // Release task if requested
      if (args.release) {
        task.claimed_by = null;
        if (task.claimed_at !== undefined) {
          task.claimed_at = null;
        }
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
      releaseLock(taskFile, owner);
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
