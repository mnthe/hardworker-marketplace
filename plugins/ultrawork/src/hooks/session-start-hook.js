#!/usr/bin/env bun

/**
 * SessionStart Hook - Cleanup old ultrawork sessions and provide session ID
 * v1.0: JavaScript version with JSDoc types
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {string} [agent_type] - NEW in Claude Code v2.1.4 (e.g., "ultrawork:worker")
 */

/**
 * @typedef {Object} SessionData
 * @property {string} [phase]
 */

/**
 * SessionStart hook output format (top-level properties, no hookSpecificOutput)
 * @typedef {Object} HookOutput
 * @property {string} [systemMessage] - Message shown to Claude
 */

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
 * Cleanup old sessions (completed/cancelled/failed older than 7 days)
 * @returns {void}
 */
function cleanupOldSessions() {
  const sessionsDir = path.join(os.homedir(), '.claude', 'ultrawork', 'sessions');

  if (!fs.existsSync(sessionsDir)) {
    return;
  }

  try {
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
    const sessionDirs = entries.filter(e => e.isDirectory());

    // Only cleanup if there are more than 10 sessions
    if (sessionDirs.length <= 10) {
      return;
    }

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const entry of sessionDirs) {
      const sessionPath = path.join(sessionsDir, entry.name);
      const sessionJsonPath = path.join(sessionPath, 'session.json');

      if (!fs.existsSync(sessionJsonPath)) {
        continue;
      }

      // Check if directory is older than 7 days
      const stats = fs.statSync(sessionPath);
      if (stats.mtimeMs > sevenDaysAgo) {
        continue;
      }

      // Check if session is in terminal state
      try {
        /** @type {SessionData} */
        const sessionData = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
        const phase = sessionData.phase || '';

        if (phase === 'COMPLETE' || phase === 'CANCELLED' || phase === 'FAILED') {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (err) {
        // Ignore parse errors, just skip this session
        continue;
      }
    }
  } catch (err) {
    // Silently ignore cleanup errors
  }
}

/**
 * Main hook logic
 * @returns {Promise<void>}
 */
async function main() {
  try {
    // Read stdin JSON
    const input = await readStdin();
    /** @type {HookInput} */
    const hookInput = JSON.parse(input);

    // Extract session_id and agent_type
    const sessionId = hookInput.session_id;
    const agentType = hookInput.agent_type;

    // Log agent type for tracking/debugging (to stderr)
    if (agentType) {
      console.error(`[ultrawork] SessionStart: agent_type=${agentType}`);
    }

    // Cleanup old sessions
    cleanupOldSessions();

    // Output session ID for AI to use
    /** @type {HookOutput} */
    const output = {};

    if (sessionId) {
      let contextMessage = `═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION ID (USE THIS VALUE DIRECTLY)
═══════════════════════════════════════════════════════════
 CLAUDE_SESSION_ID: ${sessionId}

 When calling ultrawork scripts, use the EXACT value above:
 --session ${sessionId}

 DO NOT use placeholders like {SESSION_ID} or $SESSION_ID
═══════════════════════════════════════════════════════════`;

      // Add agent type info if present
      if (agentType) {
        contextMessage += `\n Agent Type: ${agentType}`;
      }

      output.systemMessage = contextMessage;
    }

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Even on error, output minimal valid JSON and exit 0
    console.log('{}');
    process.exit(0);
  }
}

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
