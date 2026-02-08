#!/usr/bin/env bun

/**
 * SubagentStop hook handler for teamwork orchestrator completion.
 *
 * Fires when the orchestrator sub-agent (spawned by /teamwork command) finishes.
 * Reports project completion status by reading the project metadata and task state.
 *
 * Matcher: "teamwork:orchestrator" — only fires for orchestrator agent type.
 *
 * Input schema (SubagentStop, verified via live testing):
 * @see docs/plans/2026-02-07-ultrawork-hook-improvement-design.md
 * @see https://code.claude.com/docs/en/hooks
 *
 * @typedef {Object} SubagentStopInput
 * @property {string} session_id - Parent session ID
 * @property {string} agent_id - Orchestrator agent ID (e.g., "a3309e1")
 * @property {string} agent_type - "teamwork:orchestrator" (matched by hooks.json)
 * @property {string} agent_transcript_path - Path to orchestrator's transcript JSONL
 * @property {boolean} stop_hook_active - Whether stop hook is already active
 * @property {string} hook_event_name - "SubagentStop"
 * @property {string} permission_mode - Permission mode (e.g., "default", "bypassPermissions")
 * @property {string} cwd - Working directory
 * @property {string} transcript_path - Parent session transcript path
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseHookInput, passesGuards } = require('../lib/hook-utils.js');

// ============================================================================
// Main
// ============================================================================

async function main() {
  /** @type {SubagentStopInput} */
  const input = await parseHookInput();
  if (!passesGuards(input)) {
    process.exit(0);
  }

  const { agent_type, agent_id, agent_transcript_path } = input;

  // Guard: only handle teamwork orchestrator
  if (agent_type !== 'teamwork:orchestrator') {
    process.exit(0);
  }

  // Try to read orchestrator's final output from transcript
  let orchestratorResult = null;
  if (agent_transcript_path) {
    try {
      orchestratorResult = getLastAssistantMessage(agent_transcript_path);
    } catch {
      // Transcript read failed - continue without it
    }
  }

  // Try to find the active teamwork project
  const teamworkDir = path.join(os.homedir(), '.claude', 'teamwork');
  let projectSummary = null;

  try {
    if (fs.existsSync(teamworkDir)) {
      // Find most recent project.json
      const projects = findProjectFiles(teamworkDir);
      if (projects.length > 0) {
        const latest = projects.sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        )[0];
        projectSummary = latest;
      }
    }
  } catch {
    // Project read failed - continue without it
  }

  // Structured JSON output
  const output = {
    event: 'orchestrator_completed',
    agent_id: agent_id || null,
    agent_type
  };

  if (projectSummary) {
    output.project = projectSummary.project;
    output.goal = projectSummary.goal;
    output.message = `Teamwork orchestrator completed for project "${projectSummary.project}".`;
  } else {
    output.message = 'Teamwork orchestrator completed.';
  }

  if (orchestratorResult) {
    // Include a brief excerpt (first 500 chars) of the orchestrator's final message
    output.result_excerpt = orchestratorResult.substring(0, 500);
  }

  console.log(JSON.stringify(output));
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Read the last assistant text message from a transcript JSONL file.
 * @param {string} transcriptPath - Path to .jsonl transcript file
 * @returns {string|null} Last assistant text content, or null
 */
function getLastAssistantMessage(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) return null;

  const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n');

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'assistant' && entry.message?.content) {
        const textContent = entry.message.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        if (textContent) return textContent;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Find all project.json files in the teamwork directory.
 * @param {string} baseDir - Teamwork base directory
 * @returns {Array<Object>} Array of project metadata objects
 */
function findProjectFiles(baseDir) {
  const projects = [];
  try {
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const projectFile = path.join(baseDir, entry.name, 'project.json');
      if (fs.existsSync(projectFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(projectFile, 'utf-8'));
          projects.push(data);
        } catch {
          // Skip unreadable project files
        }
      }
    }
  } catch {
    // Directory read failed
  }
  return projects;
}

main().catch(() => {
  process.exit(0);
});
