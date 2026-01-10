/**
 * Ultrawork Session Utilities
 * Common functions for session ID management
 * TypeScript port of session-utils.sh
 */
import { Session } from './types';
/**
 * Get the base ultrawork directory
 * Returns: ~/.claude/ultrawork
 */
export declare function getUltraworkBase(): string;
/**
 * Get sessions directory
 * Returns: ~/.claude/ultrawork/sessions
 */
export declare function getSessionsDir(): string;
/**
 * Get session directory for a session ID
 */
export declare function getSessionDir(sessionId: string): string;
/**
 * Get session.json path for a session ID
 */
export declare function getSessionFile(sessionId: string): string;
/**
 * Validate session ID and return session file path
 * Throws error if session doesn't exist
 */
export declare function resolveSessionId(sessionId: string): string;
/**
 * Check if session exists and is active (not in terminal state)
 */
export declare function isSessionActive(sessionId: string): boolean;
/**
 * List all active sessions (scans all session directories)
 */
export declare function listActiveSessions(): string[];
/**
 * Read session data with proper error handling
 */
export declare function readSession(sessionId: string): Session;
/**
 * Update session data with file locking
 * Uses an updater function to transform the session
 */
export declare function updateSession(sessionId: string, updater: (session: Session) => Session): Promise<void>;
/**
 * Get Claude session_id from environment variable
 * Hooks set ULTRAWORK_STDIN_SESSION_ID before calling scripts
 */
export declare function getClaudeSessionId(): string | undefined;
/**
 * Get session.json path for current session from environment
 */
export declare function getCurrentSessionFile(): string | undefined;
/**
 * Clean up old sessions (completed/cancelled/failed older than N days)
 */
export declare function cleanupOldSessions(days?: number): void;
/**
 * Alias for getClaudeSessionId (backward compatibility)
 */
export declare function getCurrentSessionId(): string | undefined;
//# sourceMappingURL=session-utils.d.ts.map