#!/usr/bin/env node

/**
 * SessionStart Hook - Cleanup old ultrawork sessions and provide session ID
 * v1.0: TypeScript port from bash version
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface HookInput {
  session_id?: string;
  [key: string]: unknown;
}

interface SessionData {
  phase?: string;
  [key: string]: unknown;
}

interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    additionalContext?: string;
  };
}

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
 * Cleanup old sessions (completed/cancelled/failed older than 7 days)
 */
function cleanupOldSessions(): void {
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
        const sessionData = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8')) as SessionData;
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
 */
async function main(): Promise<void> {
  try {
    // Read stdin JSON
    const input = await readStdin();
    const hookInput: HookInput = JSON.parse(input);

    // Extract session_id
    const sessionId = hookInput.session_id;

    // Cleanup old sessions
    cleanupOldSessions();

    // Output session ID for AI to use
    const output: HookOutput = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart'
      }
    };

    if (sessionId) {
      output.hookSpecificOutput.additionalContext =
        `═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION ID (USE THIS VALUE DIRECTLY)
═══════════════════════════════════════════════════════════
 CLAUDE_SESSION_ID: ${sessionId}

 When calling ultrawork scripts, use the EXACT value above:
 --session ${sessionId}

 DO NOT use placeholders like {SESSION_ID} or $SESSION_ID
═══════════════════════════════════════════════════════════`;
    }

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Even on error, output minimal valid JSON and exit 0
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart'
      }
    }));
    process.exit(0);
  }
}

// Handle stdin
if (process.stdin.isTTY) {
  // No stdin available, output minimal response
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart'
    }
  }));
  process.exit(0);
} else {
  // Read stdin and process
  process.stdin.setEncoding('utf8');
  main().catch(() => {
    // On error, output minimal valid JSON and exit 0
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart'
      }
    }));
    process.exit(0);
  });
}
