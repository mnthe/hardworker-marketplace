#!/usr/bin/env bun

/**
 * Subagent Stop Tracking Hook
 * Captures worker agent results when they complete and updates session state
 * v1.0: JavaScript version with JSDoc types
 */

const fs = require('fs');
const path = require('path');
const {
  getSessionFile,
  getSessionDir,
  updateSession,
} = require('../lib/session-utils.js');

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').EvidenceEntry} EvidenceEntry
 */

// ============================================================================
// Hook Types
// ============================================================================

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {string} [agent_id]
 * @property {string} [output]
 * @property {string} [task_id]
 */

/**
 * @typedef {Object} HookOutput
 * @property {Object} hookSpecificOutput
 * @property {string} hookSpecificOutput.hookEventName
 */

/**
 * @typedef {Object} Worker
 * @property {string} agent_id
 * @property {string} task_id
 * @property {string} status
 * @property {string} [started_at]
 * @property {string} [completed_at]
 * @property {string} [failure_reason]
 */

/**
 * @typedef {Session & { workers?: Worker[] }} SessionWithWorkers
 */

// ============================================================================
// Stdin/Stdout Functions
// ============================================================================

/**
 * Read all stdin data
 * @returns {Promise<string>}
 */
async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

/**
 * Output hook response
 * @returns {void}
 */
function outputResponse() {
  /** @type {HookOutput} */
  const output = {
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
    },
  };
  console.log(JSON.stringify(output));
}

// ============================================================================
// Worker Detection
// ============================================================================

/**
 * Check if agent is tracked as ultrawork worker
 * @param {SessionWithWorkers} session
 * @param {string} agentId
 * @returns {boolean}
 */
function isTrackedWorker(session, agentId) {
  const workers = session.workers || [];
  return workers.some((w) => w.agent_id === agentId);
}

/**
 * Check if task exists in session
 * @param {string} sessionId
 * @param {string} taskId
 * @returns {boolean}
 */
function taskExists(sessionId, taskId) {
  const sessionDir = getSessionDir(sessionId);
  const taskFile = path.join(sessionDir, 'tasks', `${taskId}.json`);
  return fs.existsSync(taskFile);
}

// ============================================================================
// Status Detection
// ============================================================================

/**
 * Parse agent output to determine completion status
 * @param {string} output
 * @returns {{ status: string; failureReason: string }}
 */
function determineStatus(output) {
  const lowerOutput = output.toLowerCase();

  if (
    lowerOutput.includes('task failed') ||
    lowerOutput.includes('failed') ||
    lowerOutput.includes('error')
  ) {
    // Extract failure reason (first 3 lines with fail/error)
    const lines = output.split('\n');
    const errorLines = lines
      .filter(
        (line) =>
          line.toLowerCase().includes('fail') ||
          line.toLowerCase().includes('error')
      )
      .slice(0, 3);

    return {
      status: 'failed',
      failureReason: errorLines.join(' ').trim(),
    };
  }

  return {
    status: 'completed',
    failureReason: '',
  };
}

/**
 * Extract task ID from agent output if not provided
 * @param {string} output
 * @returns {string}
 */
function extractTaskId(output) {
  const match = output.match(/Task.*?:\s*([A-Z]-\d+)/);
  return match ? match[1] : '';
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main() {
  try {
    // Read stdin JSON
    const input = await readStdin();
    /** @type {HookInput} */
    const hookInput = JSON.parse(input);

    // Parse hook input fields
    const agentId = hookInput.agent_id || '';
    const agentOutput = hookInput.output || '';
    let taskId = hookInput.task_id || '';

    // Get session ID from input
    const sessionId = hookInput.session_id;

    // No active ultrawork session - not an ultrawork worker
    if (!sessionId) {
      outputResponse();
      return;
    }

    // Check if session file exists
    const sessionFile = getSessionFile(sessionId);
    if (!fs.existsSync(sessionFile)) {
      outputResponse();
      return;
    }

    // Read session
    const content = fs.readFileSync(sessionFile, 'utf-8');
    /** @type {SessionWithWorkers} */
    const session = JSON.parse(content);

    // Check if this agent is tracked as an ultrawork worker
    const isWorker = isTrackedWorker(session, agentId);

    if (!isWorker) {
      // Check if this task_id exists in our session
      if (taskId) {
        if (!taskExists(sessionId, taskId)) {
          outputResponse();
          return; // Not an ultrawork worker
        }
      } else {
        outputResponse();
        return; // No task_id and not in workers array
      }
    }

    // Parse worker output for status
    const { status, failureReason } = determineStatus(agentOutput);

    // Extract task ID if not provided
    if (!taskId && isWorker) {
      const workers = session.workers || [];
      const worker = workers.find((w) => w.agent_id === agentId);
      if (worker) {
        taskId = worker.task_id;
      }
    }

    if (!taskId) {
      // Try to extract from agent output
      taskId = extractTaskId(agentOutput);
    }

    // Timestamp
    const timestamp = new Date().toISOString();

    // Update worker status and task status in session
    if (taskId) {
      try {
        await updateSession(sessionId, (s) => {
          const sessionWithWorkers = /** @type {SessionWithWorkers} */ (s);
          const workers = sessionWithWorkers.workers || [];

          // Update or add worker entry
          const workerIndex = workers.findIndex(
            (w) => w.agent_id === agentId
          );

          if (workerIndex >= 0) {
            // Update existing worker
            workers[workerIndex] = {
              ...workers[workerIndex],
              status,
              completed_at: timestamp,
              ...(failureReason && { failure_reason: failureReason }),
            };
          } else {
            // Add new worker entry
            workers.push({
              agent_id: agentId,
              task_id: taskId,
              started_at: timestamp,
              completed_at: timestamp,
              status,
            });
          }

          // Add evidence log entry
          const outputLines = agentOutput.split('\n');
          const summary = outputLines.slice(0, 3).join(' ');

          /** @type {EvidenceEntry} */
          const evidence = {
            type: 'agent_completed',
            timestamp,
            agent_id: agentId,
            task_id: taskId,
          };

          // Add custom fields
          const completedEvidence = {
            ...evidence,
            status,
            summary,
          };

          return {
            ...sessionWithWorkers,
            workers,
            evidence_log: [...s.evidence_log, completedEvidence],
          };
        });

        // Log completion for debugging
        console.error(
          `Agent ${agentId} completed (task: ${taskId}, status: ${status})`
        );
      } catch (err) {
        console.error(`Failed to update session for agent ${agentId}:`, err);
      }
    }

    // Output response
    outputResponse();
  } catch {
    // Even on error, output response and exit 0
    outputResponse();
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Handle stdin
if (process.stdin.isTTY) {
  // No stdin available, output response
  outputResponse();
  process.exit(0);
} else {
  // Read stdin and process
  process.stdin.setEncoding('utf8');
  main()
    .then(() => process.exit(0))
    .catch(() => {
      // On error, output response and exit 0
      outputResponse();
      process.exit(0);
    });
}
