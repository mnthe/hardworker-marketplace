#!/usr/bin/env bun

/**
 * TaskCompleted hook handler for teamwork v3.
 *
 * Fires when a task is marked as completed. Reads all tasks for the team
 * and outputs progress summary. When all tasks are done, signals readiness
 * for final verification.
 *
 * Input (stdin JSON, schema TBD - defensive parsing):
 *   { task_id, team_name, status, ... }
 *
 * Output (stdout):
 *   Progress message indicating completed/total tasks.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Read hook input from stdin (defensive parsing)
  let input = {};
  try {
    const raw = await Bun.stdin.text();
    if (raw && raw.trim()) {
      input = JSON.parse(raw);
    }
  } catch {
    // Invalid or missing JSON input - exit gracefully
    process.exit(0);
  }

  const teamName = input.team_name;
  if (!teamName) {
    // No team context available - nothing to report
    process.exit(0);
  }

  // Attempt to read tasks from native task directory
  // Note: exact path may vary; defensive file access
  const tasksDir = path.join(os.homedir(), '.claude', 'tasks', teamName);

  let tasks = [];
  try {
    if (fs.existsSync(tasksDir)) {
      const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(tasksDir, file), 'utf-8');
          const task = JSON.parse(content);
          tasks.push(task);
        } catch {
          // Skip unreadable task files
        }
      }
    }
  } catch {
    // Directory read failed - exit gracefully
    process.exit(0);
  }

  const total = tasks.length;
  if (total === 0) {
    // No tasks found - exit gracefully
    process.exit(0);
  }

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = total - completed - inProgress;

  if (completed === total) {
    console.log(`All ${total} tasks completed. Ready for final verification.`);
  } else {
    console.log(`Progress: ${completed}/${total} completed, ${inProgress} in progress, ${pending} pending.`);
  }
}

main().catch(() => {
  // Top-level error catch - hooks must never fail
  process.exit(0);
});
