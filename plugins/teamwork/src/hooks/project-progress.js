#!/usr/bin/env bun

/**
 * TaskCompleted hook handler for teamwork v3.
 *
 * Fires when a native task is marked as completed. Reads all tasks for the team
 * and outputs a structured progress summary. When all tasks are done, signals
 * readiness for final verification.
 *
 * @see https://code.claude.com/docs/en/hooks
 * @see https://code.claude.com/docs/en/agent-teams
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// Types (based on Claude Code hook input schema)
// ============================================================================

/**
 * TaskCompleted hook input.
 * Note: Exact schema is not fully documented. Fields are parsed defensively.
 *
 * @typedef {Object} TaskCompletedInput
 * @property {string} [session_id] - Current session ID
 * @property {string} [hook_event_name] - "TaskCompleted"
 * @property {string} [task_id] - ID of the completed task
 * @property {string} [team_name] - Team name for the task list
 * @property {string} [status] - New task status ("completed")
 * @property {boolean} [stop_hook_active] - Whether stop hook is already active
 */

// ============================================================================
// Main
// ============================================================================

async function main() {
  /** @type {TaskCompletedInput} */
  let input = {};
  try {
    const raw = await Bun.stdin.text();
    if (raw && raw.trim()) {
      input = JSON.parse(raw);
    }
  } catch {
    process.exit(0);
  }

  // Guard: stop_hook_active prevents infinite loops
  if (input.stop_hook_active) {
    process.exit(0);
  }

  const teamName = input.team_name;
  if (!teamName) {
    process.exit(0);
  }

  const tasksDir = path.join(os.homedir(), '.claude', 'tasks', teamName);

  let tasks = [];
  try {
    if (fs.existsSync(tasksDir)) {
      const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(tasksDir, file), 'utf-8');
          tasks.push(JSON.parse(content));
        } catch {
          // Skip unreadable task files
        }
      }
    }
  } catch {
    process.exit(0);
  }

  const total = tasks.length;
  if (total === 0) {
    process.exit(0);
  }

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = total - completed - inProgress;

  // Structured JSON output for orchestrator context
  const output = {
    event: 'task_completed',
    task_id: input.task_id || null,
    progress: { total, completed, in_progress: inProgress, pending },
    all_done: completed === total
  };

  if (completed === total) {
    output.message = `All ${total} tasks completed. Ready for final verification.`;
  } else {
    output.message = `Progress: ${completed}/${total} completed, ${inProgress} in progress, ${pending} pending.`;
  }

  console.log(JSON.stringify(output));
}

main().catch(() => {
  process.exit(0);
});
