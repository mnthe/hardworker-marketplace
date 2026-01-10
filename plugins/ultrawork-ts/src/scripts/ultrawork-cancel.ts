#!/usr/bin/env node

/**
 * Ultrawork Cancel Script
 * Sets phase to CANCELLED, cancelled_at to current timestamp
 */

import * as fs from 'fs';
import { getSessionFile, readSession, updateSession } from '../lib/session-utils';
import { Session } from '../lib/types';

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(): { sessionId?: string; help: boolean } {
  const args = process.argv.slice(2);
  let sessionId: string | undefined;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-h':
      case '--help':
        help = true;
        break;
      case '--session':
        if (i + 1 < args.length) {
          sessionId = args[i + 1];
          i++; // Skip next argument
        } else {
          console.error('❌ Error: --session requires a session ID argument');
          process.exit(1);
        }
        break;
    }
  }

  return { sessionId, help };
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
═══════════════════════════════════════════════════════════
 ULTRAWORK-CANCEL - Cancel Session
═══════════════════════════════════════════════════════════

USAGE:
  ultrawork-cancel --session <id>

OPTIONS:
  --session <id>   Session ID (required, provided by AI)
  -h, --help       Show this help message

═══════════════════════════════════════════════════════════
`);
}

// ============================================================================
// Cancel Session
// ============================================================================

async function cancelSession(sessionId: string): Promise<void> {
  const sessionFile = getSessionFile(sessionId);

  if (!fs.existsSync(sessionFile)) {
    console.error(`❌ Session ${sessionId} not found.`);
    process.exit(1);
  }

  let session: Session;
  try {
    session = readSession(sessionId);
  } catch (error) {
    console.error(`❌ Failed to read session: ${error}`);
    process.exit(1);
  }

  // Check if already cancelled
  if (session.cancelled_at && session.cancelled_at !== null) {
    console.log(`Session ${sessionId} already cancelled at ${session.cancelled_at}`);
    process.exit(0);
  }

  const timestamp = new Date().toISOString();

  // Update session
  try {
    await updateSession(sessionId, (s: Session) => ({
      ...s,
      phase: 'CANCELLED',
      cancelled_at: timestamp,
      updated_at: timestamp,
    }));
  } catch (error) {
    console.error(`❌ Failed to update session: ${error}`);
    process.exit(1);
  }

  // Output cancellation message
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' ULTRAWORK SESSION CANCELLED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(` Session ID: ${session.session_id}`);
  console.log(` Goal: ${session.goal}`);
  console.log(` Started: ${session.started_at}`);
  console.log(` Cancelled: ${timestamp}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  console.log(' Session history preserved in:');
  console.log(` ${sessionFile}`);
  console.log('');
  console.log(' Start a new session with:');
  console.log(' /ultrawork "your new goal"');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const { sessionId, help } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  if (!sessionId) {
    console.error('❌ Error: --session is required');
    process.exit(1);
  }

  await cancelSession(sessionId);
}

main().catch((error) => {
  console.error(`❌ Unexpected error: ${error}`);
  process.exit(1);
});
