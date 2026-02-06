#!/usr/bin/env bun

/**
 * TeammateIdle hook handler for teamwork v3.
 *
 * Fires when a teammate becomes idle. Checks for unassigned, unblocked tasks
 * and outputs availability information.
 *
 * Input (stdin JSON, schema TBD - defensive parsing):
 *   { teammate_name, team_name, ... }
 *
 * Output (stdout):
 *   Message indicating idle teammate and available task count.
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

  const { teammate_name, team_name } = input;
  if (!team_name) {
    // No team context available - nothing to report
    process.exit(0);
  }

  // Attempt to read tasks from native task directory
  const tasksDir = path.join(os.homedir(), '.claude', 'tasks', team_name);

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

  // Find available tasks: pending, unowned, unblocked
  const available = tasks.filter(t =>
    t.status === 'pending' &&
    !t.owner &&
    (!t.blockedBy || t.blockedBy.length === 0 ||
      t.blockedBy.every(dep =>
        tasks.find(d => d.id === dep)?.status === 'completed'
      )
    )
  );

  const displayName = teammate_name || 'Unknown teammate';

  if (available.length > 0) {
    console.log(`${displayName} idle. ${available.length} unassigned tasks available.`);
  } else {
    console.log(`${displayName} idle. No tasks available.`);
  }
}

main().catch(() => {
  // Top-level error catch - hooks must never fail
  process.exit(0);
});
