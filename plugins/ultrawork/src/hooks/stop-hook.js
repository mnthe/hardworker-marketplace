#!/usr/bin/env bun

/**
 * Stop Hook - Validates evidence sufficiency on conversation stop
 * Prevents premature exit when ultrawork session is active without verification
 * JavaScript version with JSDoc types
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir } = require('../lib/session-utils.js');
const {
  createStopResponse,
  outputAndExit,
  runHook
} = require('../lib/hook-utils.js');
const { parseHookInput, guardSession } = require('../lib/hook-guards.js');

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').Phase} Phase
 */

// ============================================================================
// Types
// ============================================================================

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {boolean} [stop_hook_active]
 */

/**
 * @typedef {Object} TaskFile
 * @property {string} [status]
 */

// ============================================================================
// Utilities
// ============================================================================

/**
 * Count completed tasks from tasks directory
 * @param {string} sessionDir
 * @returns {number}
 */
function countCompletedTasks(sessionDir) {
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
      /** @type {TaskFile} */
      const task = JSON.parse(content);

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
 * @param {string} sessionDir
 * @returns {{ pending: number; inProgress: number }}
 */
function countActiveTasks(sessionDir) {
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
      /** @type {TaskFile} */
      const task = JSON.parse(content);

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
 * @param {Array<{type: string, output_preview?: string}>} entries
 * @returns {string | null}
 */
function checkBlockedPhrases(entries) {
  const blockedPhrases = [
    'should work',
    'probably works',
    'basic implementation',
    'TODO:',
    'FIXME:',
    'you can extend'
  ];

  const recentEvidence = entries.slice(-5);

  for (const evidence of recentEvidence) {
    const output = evidence.output_preview || '';
    for (const phrase of blockedPhrases) {
      if (output.toLowerCase().includes(phrase.toLowerCase())) {
        return phrase;
      }
    }
  }

  return null;
}

/**
 * Read evidence entries from log.jsonl
 * @param {string} sessionId
 * @returns {{ total: number, entries: Array<{type: string, output_preview?: string}> }}
 */
function readEvidenceFromLog(sessionId) {
  const sessionDir = getSessionDir(sessionId);
  const evidenceLog = path.join(sessionDir, 'evidence', 'log.jsonl');
  if (!fs.existsSync(evidenceLog)) return { total: 0, entries: [] };

  const content = fs.readFileSync(evidenceLog, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);
  const entries = lines.map(l => JSON.parse(l));
  return { total: entries.length, entries };
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main() {
  const hookInput = await parseHookInput();
  const ctx = guardSession(hookInput);
  if (!ctx) {
    outputAndExit(createStopResponse());
    return;
  }
  const { session, sessionId } = ctx;

    const phase = session.phase || 'unknown';
    const goal = session.goal || 'unknown';
    const planOnly = session.options?.plan_only || false;
    const autoMode = session.options?.auto_mode || false;

    // Terminal states - allow exit
    /** @type {Phase[]} */
    const terminalPhases = ['COMPLETE', 'CANCELLED', 'FAILED'];
    if (terminalPhases.includes(phase)) {
      outputAndExit(createStopResponse());
      return;
    }

    // Plan-only mode - allow exit after planning
    if (planOnly && phase !== 'PLANNING') {
      outputAndExit(createStopResponse());
      return;
    }

    // Interactive mode planning - orchestrator does planning inline, don't block
    if (phase === 'PLANNING' && !autoMode) {
      outputAndExit(createStopResponse());
      return;
    }

    // Check for blocked phrases in recent evidence
    const { total: evidenceCount, entries: evidenceEntries } = readEvidenceFromLog(sessionId);
    const blockedPhrase = checkBlockedPhrases(evidenceEntries);
    if (blockedPhrase) {
      outputAndExit(createStopResponse({
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
  /ultrawork-clean   - Cancel session`,
        systemMessage: `⚠️ ULTRAWORK [${sessionId}]: Incomplete work detected`
      }));
      return;
    }

    // For EXECUTION phase, require evidence for completed tasks
    if (phase === 'EXECUTION') {
      const sessionDir = getSessionDir(sessionId);
      const completedTasks = countCompletedTasks(sessionDir);
      // evidenceCount already computed above from readEvidenceFromLog

      // Require at least 1 evidence entry per completed task
      if (completedTasks > 0 && evidenceCount < completedTasks) {
        outputAndExit(createStopResponse({
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
  /ultrawork-clean   - Cancel session`,
          systemMessage: `⚠️ ULTRAWORK [${sessionId}]: Insufficient evidence`
        }));
        return;
      }
    }

    // If all tasks are done but verifier hasn't run, guide to VERIFICATION
    if (phase === 'EXECUTION') {
      const sessionDir = getSessionDir(sessionId);
      const { pending, inProgress } = countActiveTasks(sessionDir);
      if (pending === 0 && inProgress === 0 && !session.verifier_passed) {
        outputAndExit(createStopResponse({
          decision: 'block',
          reason: `VERIFICATION REQUIRED\n\nSession ID: ${sessionId}\nGoal: ${goal}\n\nAll tasks are resolved but Verifier has not run.\nYou MUST enter VERIFICATION phase and spawn the Verifier agent.\n\nCommands:\n  /ultrawork-status   - Check progress`,
          systemMessage: `⚠️ ULTRAWORK [${sessionId}]: Verifier required before completion`
        }));
        return;
      }
    }

    // Active session not complete - block exit with phase-specific message
    let reason = '';
    let systemMsg = '';

    switch (phase) {
      case 'PLANNING':
        // Only reaches here if AUTO_MODE is true (planner agent running in background)
        reason = 'Planner agent is creating task graph. Wait for planning to complete or use /ultrawork-clean.';
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Planning in progress for '${goal}'`;
        break;

      case 'EXECUTION':
        reason = 'Workers are implementing tasks. Wait for execution to complete or use /ultrawork-clean.';
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Execution in progress for '${goal}'`;
        break;

      case 'VERIFICATION':
        reason = 'Verifier is checking evidence. Wait for verification to complete or use /ultrawork-clean.';
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Verification in progress for '${goal}'`;
        break;

      case 'DOCUMENTATION':
        reason = 'Documenter is processing documents. Wait for documentation to complete or use /ultrawork-clean.';
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Documentation in progress for '${goal}'`;
        break;

      default:
        reason = `Ultrawork session is active (phase: ${phase}). Complete the session or use /ultrawork-clean.`;
        systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Session active for '${goal}'`;
        break;
    }

    outputAndExit(createStopResponse({
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
  /ultrawork-clean   - Cancel session`,
      systemMessage: systemMsg
    }));
}

// Entry point
runHook(main, createStopResponse);
