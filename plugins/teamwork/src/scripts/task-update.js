#!/usr/bin/env bun
/**
 * task-update.js - Update teamwork task
 *
 * Usage: task-update.js --project <name> --team <name> --id <task_id> [--status open|resolved] [--add-evidence "..."] [--owner <id>] [--release]
 */

const fs = require('fs');
const { acquireLock, releaseLock } = require('../lib/file-lock.js');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getTaskFile, updateSwarmWorkerOnComplete } = require('../lib/project-utils.js');
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
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [role]
 * @property {string} [workerId]
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
  '--title': { key: 'title' },
  '--description': { key: 'description', aliases: ['-d'] },
  '--role': { key: 'role' },
  '--worker-id': { key: 'workerId', aliases: ['-w'] },
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

      // Update title if provided
      if (args.title !== undefined) {
        task.title = args.title;
      }

      // Update description if provided
      if (args.description !== undefined) {
        task.description = args.description;
      }

      // Update role if provided
      if (args.role !== undefined) {
        task.role = args.role;
      }

      // Update status if provided
      if (args.status) {
        // Validate status value - only allow valid task statuses
        const validStatuses = ['open', 'in_progress', 'resolved'];
        if (!validStatuses.includes(args.status)) {
          console.error(`Error: Invalid status "${args.status}". Valid values: ${validStatuses.join(', ')}`);
          console.error('  Note: "pending" is NOT a valid task status (use "open" instead)');
          process.exit(1);
        }

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

          task.completed_at = new Date().toISOString();
        }

        task.status = args.status;
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

      // Send idle notification if task was resolved with worker-id
      if (args.status === 'resolved' && args.workerId) {
        const { sendMessage } = require('../lib/mailbox.js');

        await sendMessage(args.project, args.team, {
          from: args.workerId,
          to: 'orchestrator',
          type: 'idle_notification',
          payload: {
            worker_id: args.workerId,
            completed_task_id: args.id,
            completed_status: 'resolved'
          }
        });
      }

      // Update swarm worker state if task was resolved
      // This tracks tasks_completed, clears current_task, and updates last_heartbeat
      if (args.status === 'resolved') {
        const sessionId = owner || process.env.CLAUDE_SESSION_ID;
        if (sessionId) {
          updateSwarmWorkerOnComplete(args.project, args.team, sessionId, args.id);
        }
      }

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
