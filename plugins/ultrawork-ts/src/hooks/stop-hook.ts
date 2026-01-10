#!/usr/bin/env node

/**
 * Stop Hook - Validates evidence sufficiency on conversation stop
 * Prevents premature exit when ultrawork session is active without verification
 * TypeScript port from bash version
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSessionDir, getSessionFile } from '../lib/session-utils';
import { Session, Phase } from '../lib/types';

// ============================================================================
// Types
// ============================================================================

interface HookInput {
  session_id?: string;
  [key: string]: unknown;
}

interface HookOutput {
  decision?: 'block' | 'allow';
  reason?: string;
  systemMessage?: string;
}

interface TaskFile {
  status?: string;
  [key: string]: unknown;
}

// ============================================================================
// Utilities
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
 * Count completed tasks from tasks directory
 */
function countCompletedTasks(sessionDir: string): number {
  const tasksDir = path.join(sessionDir, 'tasks');

  if (!fs.existsSync(tasksDir)) {
    return 0;
  }

  let completed = 0;
  const files = fs.readdirSync(tasksDir);

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(tasksDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const task = JSON.parse(content) as TaskFile;

      if (task.status === 'resolved') {
        completed++;
      }
    } catch {
      // Skip invalid task files
      continue;
    }
  }

  return completed;
}

/**
 * Count pending and in-progress tasks
 */
function countActiveTasks(sessionDir: string): { pending: number; inProgress: number } {
  const tasksDir = path.join(sessionDir, 'tasks');

  if (!fs.existsSync(tasksDir)) {
    return { pending: 0, inProgress: 0 };
  }

  let pending = 0;
  let inProgress = 0;
  const files = fs.readdirSync(tasksDir);

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(tasksDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const task = JSON.parse(content) as TaskFile;

      if (task.status === 'open' || task.status === 'pending') {
        pending++;
      } else if (task.status === 'in_progress') {
        inProgress++;
      }
    } catch {
      continue;
    }
  }

  return { pending, inProgress };
}

/**
 * Check for blocked phrases in recent evidence
 */
function checkBlockedPhrases(session: Session): string | null {
  const blockedPhrases = [
    'should work',
    'probably works',
    'basic implementation',
    'TODO:',
    'FIXME:',
    'you can extend'
  ];

  // Check last 5 evidence entries
  const recentEvidence = session.evidence_log.slice(-5);

  for (const evidence of recentEvidence) {
    // Check output_preview field if it exists
    const output = (evidence as { output_preview?: string }).output_preview || '';

    for (const phrase of blockedPhrases) {
      if (output.toLowerCase().includes(phrase.toLowerCase())) {
        return phrase;
      }
    }
  }

  return null;
}

/**
 * Output hook response and exit
 */
function outputAndExit(output: HookOutput): void {
  console.log(JSON.stringify(output));
  process.exit(0);
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main(): Promise<void> {
  try {
    // Read stdin JSON
    const input = await readStdin();
    const hookInput: HookInput = JSON.parse(input);

    // Extract session_id
    const sessionId = hookInput.session_id;

    // No session_id - allow exit
    if (!sessionId) {
      outputAndExit({});
      return;
    }

    // Get session file
    const sessionFile = getSessionFile(sessionId);

    // Session file doesn't exist - not an ultrawork session, allow exit
    if (!fs.existsSync(sessionFile)) {
      outputAndExit({});
      return;
    }

    // Parse session state
    const content = fs.readFileSync(sessionFile, 'utf-8');
    const session: Session = JSON.parse(content);

    const phase = session.phase || 'unknown';
    const goal = session.goal || 'unknown';
    const skipVerify = session.options?.skip_verify || false;
    const planOnly = session.options?.plan_only || false;
    const autoMode = session.options?.auto_mode || false;

    // Terminal states - allow exit
    const terminalPhases: Phase[] = ['COMPLETE', 'CANCELLED', 'FAILED'];
    if (terminalPhases.includes(phase)) {
      outputAndExit({});
      return;
    }

    // Plan-only mode - allow exit after planning
    if (planOnly && phase !== 'PLANNING') {
      outputAndExit({});
      return;
    }

    // Skip-verify mode - allow exit after execution if tasks done
    if (skipVerify && phase === 'EXECUTION') {
      const sessionDir = getSessionDir(sessionId);
      const { pending, inProgress } = countActiveTasks(sessionDir);

      if (pending === 0 && inProgress === 0) {
        outputAndExit({});
        return;
      }
    }

    // Interactive mode planning - orchestrator does planning inline, don't block
    if (phase === 'PLANNING' && !autoMode) {
      outputAndExit({});
      return;
    }

    // Check for blocked phrases in recent evidence
    const blockedPhrase = checkBlockedPhrases(session);
    if (blockedPhrase) {
      outputAndExit({
        decision: 'block',
        reason: `INCOMPLETE WORK DETECTED

Session ID: ${sessionId}
Goal: ${goal}

Blocked phrase found: "${blockedPhrase}"

Detected blocked phrase in recent outputs. Complete work before exiting.

ZERO TOLERANCE RULES:
✗ No "should work" - require command output evidence
✗ No "basic implementation" - complete work only
✗ No TODO/FIXME in code - finish everything

Commands:
  /ultrawork-status   - Check progress
  /ultrawork-evidence - View evidence
  /ultrawork-cancel   - Cancel session`,
        systemMessage: `⚠️ ULTRAWORK [${sessionId}]: Incomplete work detected`
      });
      return;
    }

    // For EXECUTION phase, require evidence for completed tasks
    if (phase === 'EXECUTION') {
      const sessionDir = getSessionDir(sessionId);
      const completedTasks = countCompletedTasks(sessionDir);
      const evidenceCount = session.evidence_log.length;

      // Require at least 1 evidence entry per completed task
      if (completedTasks > 0 && evidenceCount < completedTasks) {
        outputAndExit({
          decision: 'block',
          reason: `INSUFFICIENT EVIDENCE

Session ID: ${sessionId}
Goal: ${goal}
Completed tasks: ${completedTasks}
Evidence collected: ${evidenceCount}

Completed tasks without sufficient evidence. Found ${evidenceCount} evidence entries for ${completedTasks} completed tasks.

Every completed task requires evidence:
• Test results (command output)
• File operations (read/write/edit)
• Verification commands

Commands:
  /ultrawork-status   - Check progress
  /ultrawork-evidence - View evidence
  /ultrawork-cancel   - Cancel session`,
          systemMessage: `⚠️ ULTRAWORK [${sessionId}]: Insufficient evidence`
        });
        return;
      }
    }

    // Active session not complete - block exit with phase-specific message
    let reason = '';
    let systemMsg = '';

    switch (phase) {
      case 'PLANNING':
        // Only reaches here if AUTO_MODE is true (planner agent running in background)
        reason = 'Planner agent is creating task graph. Wait for planning to complete or use /ultrawork-cancel.';
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Planning in progress for '${goal}'`;
        break;

      case 'EXECUTION':
        reason = 'Workers are implementing tasks. Wait for execution to complete or use /ultrawork-cancel.';
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Execution in progress for '${goal}'`;
        break;

      case 'VERIFICATION':
        reason = 'Verifier is checking evidence. Wait for verification to complete or use /ultrawork-cancel.';
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Verification in progress for '${goal}'`;
        break;

      default:
        reason = `Ultrawork session is active (phase: ${phase}). Complete the session or use /ultrawork-cancel.`;
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Session active for '${goal}'`;
        break;
    }

    const evidenceCount = session.evidence_log.length;

    outputAndExit({
      decision: 'block',
      reason: `ULTRAWORK SESSION ACTIVE

Session ID: ${sessionId}
Goal: ${goal}
Phase: ${phase}
Evidence collected: ${evidenceCount}

${reason}

Commands:
  /ultrawork-status   - Check progress
  /ultrawork-evidence - View evidence
  /ultrawork-cancel   - Cancel session`,
      systemMessage: systemMsg
    });

  } catch (err) {
    // Even on error, output minimal valid JSON and exit 0
    outputAndExit({});
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Handle stdin
if (process.stdin.isTTY) {
  // No stdin available, output minimal response
  console.log('{}');
  process.exit(0);
} else {
  // Read stdin and process
  process.stdin.setEncoding('utf8');
  main().catch(() => {
    // On error, output minimal valid JSON and exit 0
    console.log('{}');
    process.exit(0);
  });
}
