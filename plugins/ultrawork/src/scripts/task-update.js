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
const { scanForBlockedPatterns, shouldBlockCompletion } = require('../lib/blocked-patterns.js');

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
  '--session': { key: 'session', aliases: ['-s'], required: true },
  '--id': { key: 'id', aliases: ['-t', '--task', '--task-id'], required: true },
  '--status': { key: 'status', aliases: ['-S'] },
  '--add-evidence': { key: 'addEvidence', aliases: ['-e'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
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

      // Add evidence BEFORE status check (so new evidence is included in pattern scan)
      if (args.addEvidence) {
        // Match bash behavior: add as string to evidence array
        // Note: This matches the bash implementation even though the type
        // definition suggests evidence should be TaskEvidence objects
        task.evidence.push(args.addEvidence);
      }

      // Update status if provided
      if (args.status) {
        // Check for blocked patterns before allowing status=resolved
        if (args.status === 'resolved') {
          // Collect all evidence text for scanning
          const evidenceTexts = [];
          for (const evidence of task.evidence) {
            if (typeof evidence === 'string') {
              // String evidence (backward compatibility)
              evidenceTexts.push(evidence);
            } else if (typeof evidence === 'object' && evidence !== null) {
              // Structured evidence - scan relevant fields
              if (evidence.output) evidenceTexts.push(evidence.output);
              if (evidence.description) evidenceTexts.push(evidence.description);
              if (evidence.command) evidenceTexts.push(evidence.command);
            }
          }

          // Scan all evidence for blocked patterns
          const allMatches = [];
          for (const text of evidenceTexts) {
            const matches = scanForBlockedPatterns(text);
            allMatches.push(...matches);
          }

          // Block completion if error-severity patterns found
          if (shouldBlockCompletion(allMatches)) {
            const errorMatches = allMatches.filter(m => m.severity === 'error');
            console.error('Error: Cannot resolve task - blocked patterns detected in evidence:');
            for (const match of errorMatches) {
              console.error(`  - "${match.match}": ${match.message}`);
            }
            process.exit(1);
          }

          // Warn about warning-severity patterns but allow completion
          const warningMatches = allMatches.filter(m => m.severity === 'warning');
          if (warningMatches.length > 0) {
            console.error('Warning: Potentially problematic patterns in evidence:');
            for (const match of warningMatches) {
              console.error(`  - "${match.match}": ${match.message}`);
            }
          }
        }

        task.status = args.status;
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
