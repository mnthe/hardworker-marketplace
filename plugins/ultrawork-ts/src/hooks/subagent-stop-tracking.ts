#!/usr/bin/env node

/**
 * Subagent Stop Tracking Hook
 * Captures worker agent results when they complete and updates session state
 * v1.0: TypeScript port from bash version
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getSessionFile,
  getSessionDir,
  updateSession,
} from '../lib/session-utils';
import { Session, EvidenceEntry } from '../lib/types';

// ============================================================================
// Hook Types
// ============================================================================

interface HookInput {
  session_id?: string;
  agent_id?: string;
  output?: string;
  task_id?: string;
  [key: string]: unknown;
}

interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
  };
}

interface Worker {
  agent_id: string;
  task_id: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  failure_reason?: string;
}

interface SessionWithWorkers extends Session {
  workers?: Worker[];
}

// ============================================================================
// Stdin/Stdout Functions
// ============================================================================

/**
 * Read all stdin data
 */
async function readStdin(): Promise<string> {
  const chunks: string[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

/**
 * Output hook response
 */
function outputResponse(): void {
  const output: HookOutput = {
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
 */
function isTrackedWorker(
  session: SessionWithWorkers,
  agentId: string
): boolean {
  const workers = session.workers || [];
  return workers.some((w) => w.agent_id === agentId);
}

/**
 * Check if task exists in session
 */
function taskExists(sessionId: string, taskId: string): boolean {
  const sessionDir = getSessionDir(sessionId);
  const taskFile = path.join(sessionDir, 'tasks', `${taskId}.json`);
  return fs.existsSync(taskFile);
}

// ============================================================================
// Status Detection
// ============================================================================

/**
 * Parse agent output to determine completion status
 */
function determineStatus(output: string): {
  status: string;
  failureReason: string;
} {
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
 */
function extractTaskId(output: string): string {
  const match = output.match(/Task.*?:\s*([A-Z]-\d+)/);
  return match ? match[1] : '';
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main(): Promise<void> {
  try {
    // Read stdin JSON
    const input = await readStdin();
    const hookInput: HookInput = JSON.parse(input);

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
    const session = JSON.parse(content) as SessionWithWorkers;

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
          const sessionWithWorkers = s as SessionWithWorkers;
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

          const evidence: EvidenceEntry = {
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
            evidence_log: [...s.evidence_log, completedEvidence as any],
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
