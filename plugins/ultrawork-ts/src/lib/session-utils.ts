/**
 * Ultrawork Session Utilities
 * Common functions for session ID management
 * TypeScript port of session-utils.sh
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { acquireLock, releaseLock } from './file-lock';
import { Session, Phase } from './types';

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Get the base ultrawork directory
 * Returns: ~/.claude/ultrawork
 */
export function getUltraworkBase(): string {
  return path.join(os.homedir(), '.claude', 'ultrawork');
}

/**
 * Get sessions directory
 * Returns: ~/.claude/ultrawork/sessions
 */
export function getSessionsDir(): string {
  return path.join(getUltraworkBase(), 'sessions');
}

/**
 * Get session directory for a session ID
 */
export function getSessionDir(sessionId: string): string {
  return path.join(getSessionsDir(), sessionId);
}

/**
 * Get session.json path for a session ID
 */
export function getSessionFile(sessionId: string): string {
  return path.join(getSessionDir(sessionId), 'session.json');
}

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Validate session ID and return session file path
 * Throws error if session doesn't exist
 */
export function resolveSessionId(sessionId: string): string {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  const sessionFile = getSessionFile(sessionId);

  if (!fs.existsSync(sessionFile)) {
    throw new Error(
      `Session not found: ${sessionId}\nExpected file: ${sessionFile}`
    );
  }

  return sessionFile;
}

/**
 * Check if session exists and is active (not in terminal state)
 */
export function isSessionActive(sessionId: string): boolean {
  const sessionFile = getSessionFile(sessionId);

  if (!fs.existsSync(sessionFile)) {
    return false;
  }

  try {
    const content = fs.readFileSync(sessionFile, 'utf-8');
    const session = JSON.parse(content) as Session;
    const phase = session.phase || 'unknown';

    // Active phases
    const activePhases: Phase[] = ['PLANNING', 'EXECUTION', 'VERIFICATION'];
    return activePhases.includes(phase);
  } catch {
    return false;
  }
}

/**
 * List all active sessions (scans all session directories)
 */
export function listActiveSessions(): string[] {
  const sessionsDir = getSessionsDir();

  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  const sessions: string[] = [];
  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sessionId = entry.name;
      if (isSessionActive(sessionId)) {
        sessions.push(sessionId);
      }
    }
  }

  return sessions;
}

// ============================================================================
// JSON Operations with Locking
// ============================================================================

/**
 * Read session data with proper error handling
 */
export function readSession(sessionId: string): Session {
  const sessionFile = resolveSessionId(sessionId);
  const content = fs.readFileSync(sessionFile, 'utf-8');
  return JSON.parse(content) as Session;
}

/**
 * Update session data with file locking
 * Uses an updater function to transform the session
 */
export async function updateSession(
  sessionId: string,
  updater: (session: Session) => Session
): Promise<void> {
  const sessionFile = resolveSessionId(sessionId);

  const acquired = await acquireLock(sessionFile);
  if (!acquired) {
    throw new Error(`Failed to acquire lock for session ${sessionId}`);
  }

  try {
    // Read current session
    const content = fs.readFileSync(sessionFile, 'utf-8');
    const session = JSON.parse(content) as Session;

    // Apply update
    const updated = updater(session);

    // Update timestamp
    updated.updated_at = new Date().toISOString();

    // Write atomically using temp file
    const tmpFile = `${sessionFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(updated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, sessionFile);
  } finally {
    releaseLock(sessionFile);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Claude session_id from environment variable
 * Hooks set ULTRAWORK_STDIN_SESSION_ID before calling scripts
 */
export function getClaudeSessionId(): string | undefined {
  return process.env.ULTRAWORK_STDIN_SESSION_ID || undefined;
}

/**
 * Get session.json path for current session from environment
 */
export function getCurrentSessionFile(): string | undefined {
  const sessionId = getClaudeSessionId();

  if (!sessionId) {
    return undefined;
  }

  const sessionFile = getSessionFile(sessionId);
  return fs.existsSync(sessionFile) ? sessionFile : undefined;
}

/**
 * Clean up old sessions (completed/cancelled/failed older than N days)
 */
export function cleanupOldSessions(days: number = 7): void {
  const sessionsDir = getSessionsDir();

  if (!fs.existsSync(sessionsDir)) {
    return;
  }

  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sessionId = entry.name;
    const sessionDir = getSessionDir(sessionId);

    // Check directory modification time
    const stats = fs.statSync(sessionDir);
    if (stats.mtimeMs > cutoffTime) {
      continue;
    }

    // Only delete non-active sessions
    if (!isSessionActive(sessionId)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  }
}

// ============================================================================
// Backward Compatibility Aliases
// ============================================================================

/**
 * Alias for getClaudeSessionId (backward compatibility)
 */
export function getCurrentSessionId(): string | undefined {
  return getClaudeSessionId();
}
