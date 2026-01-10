#!/usr/bin/env node

/**
 * Agent Lifecycle Tracking Hook (PreToolUse)
 * Tracks when agents are spawned via Task tool during ultrawork sessions
 * v1.0: TypeScript port from bash version
 */

import * as fs from 'fs';
import {
  getSessionFile,
  updateSession,
  getClaudeSessionId,
} from '../lib/session-utils';
import { Session, Phase, EvidenceEntry } from '../lib/types';

// ============================================================================
// Hook Types
// ============================================================================

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    task_id?: string;
    description?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    permissionDecision: string;
  };
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
 * Output hook response (always allow)
 */
function outputAllow(): void {
  const output: HookOutput = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  };
  console.log(JSON.stringify(output));
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main(): Promise<void> {
  try {
    // Read stdin JSON
    const input = await readStdin();
    const hookInput: HookInput = JSON.parse(input);

    // Parse tool name
    const toolName = hookInput.tool_name || '';

    // Only process Task tool usage - exit silently for other tools
    if (toolName !== 'Task') {
      outputAllow();
      return;
    }

    // Get session ID from input
    const sessionId = hookInput.session_id;

    // No active ultrawork session - allow without tracking
    if (!sessionId) {
      outputAllow();
      return;
    }

    // Check if session file exists
    const sessionFile = getSessionFile(sessionId);
    if (!fs.existsSync(sessionFile)) {
      outputAllow();
      return;
    }

    // Read session phase
    const content = fs.readFileSync(sessionFile, 'utf-8');
    const session = JSON.parse(content) as Session;
    const phase = session.phase || 'unknown';

    // Track during active phases (PLANNING, EXECUTION, VERIFICATION)
    const activePhases: Phase[] = ['PLANNING', 'EXECUTION', 'VERIFICATION'];
    if (!activePhases.includes(phase)) {
      outputAllow();
      return;
    }

    // Parse Task tool parameters
    const taskId = hookInput.tool_input?.task_id || '';
    const description = hookInput.tool_input?.description || '';

    // If no task_id, this isn't a worker spawn (might be TaskCreate, TaskUpdate, etc.)
    if (!taskId) {
      outputAllow();
      return;
    }

    // Log agent spawn attempt
    const timestamp = new Date().toISOString();

    // Update session with agent spawn tracking (with locking)
    try {
      await updateSession(sessionId, (s) => {
        const evidence: EvidenceEntry = {
          type: 'agent_completed',
          timestamp,
          agent_id: 'spawning',
          task_id: taskId,
        };

        // Add custom fields for spawn tracking
        const spawnEvidence = {
          ...evidence,
          type: 'agent_spawn_initiated' as const,
          description,
        };

        return {
          ...s,
          evidence_log: [...s.evidence_log, spawnEvidence as any],
        };
      });
    } catch {
      // Silently ignore update errors
    }

    // Allow the Task tool to proceed
    outputAllow();
  } catch {
    // Even on error, output allow and exit 0
    outputAllow();
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Handle stdin
if (process.stdin.isTTY) {
  // No stdin available, output allow response
  outputAllow();
  process.exit(0);
} else {
  // Read stdin and process
  process.stdin.setEncoding('utf8');
  main()
    .then(() => process.exit(0))
    .catch(() => {
      // On error, output allow and exit 0
      outputAllow();
      process.exit(0);
    });
}
