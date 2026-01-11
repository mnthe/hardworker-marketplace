#!/usr/bin/env bun
/**
 * task-update.js - Update task status and evidence
 *
 * Usage: task-update.js --session <ID> --task-id <id> [--status open|resolved] [--add-evidence "..."]
 * Aliases: --task-id, --task, --id (all accepted for task identification)
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir, resolveSessionId } = require('../lib/session-utils.js');
const { acquireLock, releaseLock } = require('../lib/file-lock.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').TaskStatus} TaskStatus
 */

/**
 * @typedef {Object} ParsedArgs
 * @property {string} [session]
 * @property {string} [id]
 * @property {TaskStatus} [status]
 * @property {string} [addEvidence]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--session': { key: 'session', alias: '-s', required: true },
  '--task-id': { key: 'id', alias: '-t', required: true },
  '--status': { key: 'status', alias: '-S' },
  '--add-evidence': { key: 'addEvidence', alias: '-e' },
  '--help': { key: 'help', alias: '-h', flag: true }
};

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('task-update.js', ARG_SPEC, 'Update task status and add evidence'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

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
      /** @type {Task} */
      const task = JSON.parse(content);

      // Update status if provided
      if (args.status) {
        task.status = args.status;
      }

      // Add evidence if provided
      if (args.addEvidence) {
        // Match bash behavior: add as string to evidence array
        // Note: This matches the bash implementation even though the type
        // definition suggests evidence should be TaskEvidence objects
        task.evidence.push(args.addEvidence);
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
