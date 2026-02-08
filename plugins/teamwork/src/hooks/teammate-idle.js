#!/usr/bin/env bun

/**
 * TeammateIdle hook handler for teamwork v3.
 *
 * Fires when a teammate becomes idle (finishes current turn). Checks for
 * unassigned, unblocked tasks and outputs structured availability information.
 *
 * @see https://code.claude.com/docs/en/hooks
 * @see https://code.claude.com/docs/en/agent-teams
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseHookInput, passesGuards } = require('../lib/hook-utils.js');

// ============================================================================
// Types (based on Claude Code hook input schema)
// ============================================================================

/**
 * TeammateIdle hook input.
 * Note: Exact schema is not fully documented. Fields are parsed defensively.
 *
 * @typedef {Object} TeammateIdleInput
 * @property {string} [session_id] - Current session ID
 * @property {string} [hook_event_name] - "TeammateIdle"
 * @property {string} [teammate_name] - Name of the idle teammate
 * @property {string} [team_name] - Team name
 * @property {string} [agent_type] - Agent type (e.g., "teamwork:backend")
 * @property {boolean} [stop_hook_active] - Whether stop hook is already active
 */

// ============================================================================
// Main
// ============================================================================

async function main() {
  /** @type {TeammateIdleInput} */
  const input = await parseHookInput();
  if (!passesGuards(input)) {
    process.exit(0);
  }

  const { teammate_name, team_name, agent_type } = input;
  if (!team_name) {
    process.exit(0);
  }

  const tasksDir = path.join(os.homedir(), '.claude', 'tasks', team_name);

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

  // Extract role from agent_type if available (e.g., "teamwork:backend" → "backend")
  const role = agent_type?.startsWith('teamwork:')
    ? agent_type.split(':')[1]
    : null;

  // Structured JSON output for orchestrator context
  const output = {
    event: 'teammate_idle',
    teammate: displayName,
    role,
    available_tasks: available.length,
    total_tasks: tasks.length,
    completed_tasks: tasks.filter(t => t.status === 'completed').length
  };

  if (available.length > 0) {
    output.message = `${displayName} idle. ${available.length} unassigned tasks available.`;
    output.task_ids = available.map(t => t.id);
  } else {
    output.message = `${displayName} idle. No tasks available.`;
  }

  console.log(JSON.stringify(output));
}

main().catch(() => {
  process.exit(0);
});
