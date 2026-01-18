#!/usr/bin/env bun
/**
 * Tests for session-utils.js - Session management utilities
 *
 * IMPORTANT: Uses ULTRAWORK_TEST_BASE_DIR for test isolation
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('bun:test');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Set test base directory BEFORE importing session-utils
const TEST_BASE_DIR = path.join(os.tmpdir(), 'ultrawork-session-utils-test');
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR;

const {
  getUltraworkBase,
  getSessionsDir,
  getSessionDir,
  getSessionFile,
  resolveSessionId,
  isSessionActive,
  listActiveSessions,
  readSession,
  readSessionField,
  updateSession,
  getClaudeSessionId,
  getCurrentSessionFile,
  cleanupOldSessions,
  getCurrentSessionId
} = require('../../../plugins/ultrawork/src/lib/session-utils.js');

/**
 * Create a mock session in the TEST ultrawork directory (not real user data)
 * @param {string} sessionId - Session ID
 * @param {string} phase - Session phase
 * @returns {Object} Mock session data
 */
function createMockSession(sessionId, phase = 'PLANNING') {
  const sessionDir = getSessionDir(sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'exploration'), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'tasks'), { recursive: true });

  const sessionData = {
    version: '6.0',
    session_id: sessionId,
    working_dir: '/tmp/test-project',
    goal: 'Test session goal',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phase: phase,
    exploration_stage: 'overview',
    iteration: 1,
    plan: { approved_at: null },
    options: {
      max_workers: 0,
      max_iterations: 5,
      skip_verify: false,
      plan_only: false,
      auto_mode: false
    },
    evidence_log: [],
    cancelled_at: null
  };

  const sessionFile = getSessionFile(sessionId);
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');

  return {
    sessionId,
    sessionDir,
    sessionFile,
    sessionData,
    cleanup: () => {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    }
  };
}

describe('session-utils.js', () => {
  let session;

  // Cleanup test directory after all tests
  afterAll(() => {
    if (fs.existsSync(TEST_BASE_DIR)) {
      fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
    }
    delete process.env.ULTRAWORK_TEST_BASE_DIR;
  });

  beforeEach(() => {
    session = createMockSession('test-session-123', 'PLANNING');
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('path functions', () => {
    test('getUltraworkBase should return test base directory (isolated)', () => {
      const base = getUltraworkBase();
      // With ULTRAWORK_TEST_BASE_DIR set, should return test path
      expect(base).toBe(TEST_BASE_DIR);
    });

    test('getSessionsDir should return sessions directory', () => {
      const dir = getSessionsDir();
      expect(dir).toBe(path.join(TEST_BASE_DIR, 'sessions'));
    });

    test('getSessionDir should return session directory', () => {
      const dir = getSessionDir('abc-123');
      expect(dir).toBe(path.join(TEST_BASE_DIR, 'sessions', 'abc-123'));
    });

    test('getSessionFile should return session.json path', () => {
      const file = getSessionFile('abc-123');
      expect(file).toBe(path.join(TEST_BASE_DIR, 'sessions', 'abc-123', 'session.json'));
    });
  });

  describe('resolveSessionId', () => {
    test('should resolve valid session ID', () => {
      const filePath = resolveSessionId(session.sessionId);
      expect(filePath).toBe(session.sessionFile);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('should throw error for missing session ID', () => {
      expect(() => resolveSessionId(null)).toThrow('Session ID is required');
      expect(() => resolveSessionId('')).toThrow('Session ID is required');
    });

    test('should throw error for non-existent session', () => {
      expect(() => resolveSessionId('non-existent-session')).toThrow('Session not found');
    });
  });

  describe('isSessionActive', () => {
    test('should return true for active session (PLANNING)', () => {
      const active = isSessionActive(session.sessionId);
      expect(active).toBe(true);
    });

    test('should return true for EXECUTION phase', () => {
      // Update session to EXECUTION
      const sessionData = JSON.parse(fs.readFileSync(session.sessionFile, 'utf-8'));
      sessionData.phase = 'EXECUTION';
      fs.writeFileSync(session.sessionFile, JSON.stringify(sessionData, null, 2));

      const active = isSessionActive(session.sessionId);
      expect(active).toBe(true);
    });

    test('should return true for VERIFICATION phase', () => {
      const sessionData = JSON.parse(fs.readFileSync(session.sessionFile, 'utf-8'));
      sessionData.phase = 'VERIFICATION';
      fs.writeFileSync(session.sessionFile, JSON.stringify(sessionData, null, 2));

      const active = isSessionActive(session.sessionId);
      expect(active).toBe(true);
    });

    test('should return false for COMPLETE phase', () => {
      const sessionData = JSON.parse(fs.readFileSync(session.sessionFile, 'utf-8'));
      sessionData.phase = 'COMPLETE';
      fs.writeFileSync(session.sessionFile, JSON.stringify(sessionData, null, 2));

      const active = isSessionActive(session.sessionId);
      expect(active).toBe(false);
    });

    test('should return false for CANCELLED phase', () => {
      const sessionData = JSON.parse(fs.readFileSync(session.sessionFile, 'utf-8'));
      sessionData.phase = 'CANCELLED';
      fs.writeFileSync(session.sessionFile, JSON.stringify(sessionData, null, 2));

      const active = isSessionActive(session.sessionId);
      expect(active).toBe(false);
    });

    test('should return false for non-existent session', () => {
      const active = isSessionActive('non-existent-session');
      expect(active).toBe(false);
    });
  });

  describe('listActiveSessions', () => {
    test('should list active sessions', () => {
      const activeSessions = listActiveSessions();
      expect(activeSessions).toContain(session.sessionId);
    });

    test('should not list completed sessions', () => {
      // Mark session as complete
      const sessionData = JSON.parse(fs.readFileSync(session.sessionFile, 'utf-8'));
      sessionData.phase = 'COMPLETE';
      fs.writeFileSync(session.sessionFile, JSON.stringify(sessionData, null, 2));

      const activeSessions = listActiveSessions();
      expect(activeSessions).not.toContain(session.sessionId);
    });

    test('should return array when listing sessions', () => {
      const activeSessions = listActiveSessions();
      expect(Array.isArray(activeSessions)).toBe(true);
    });
  });

  describe('readSession', () => {
    test('should read session data', () => {
      const data = readSession(session.sessionId);

      expect(data.session_id).toBe(session.sessionId);
      expect(data.phase).toBe('PLANNING');
      expect(data.exploration_stage).toBe('overview');
    });

    test('should throw error for non-existent session', () => {
      expect(() => readSession('non-existent')).toThrow('Session not found');
    });
  });

  describe('readSessionField', () => {
    test('should read top-level field (phase)', () => {
      const phase = readSessionField(session.sessionId, 'phase');
      expect(phase).toBe('PLANNING');
    });

    test('should read top-level field (session_id)', () => {
      const id = readSessionField(session.sessionId, 'session_id');
      expect(id).toBe(session.sessionId);
    });

    test('should read nested field', () => {
      const autoMode = readSessionField(session.sessionId, 'options.auto_mode');
      expect(autoMode).toBe(false);
    });

    test('should read number field', () => {
      const maxWorkers = readSessionField(session.sessionId, 'options.max_workers');
      expect(maxWorkers).toBe(0);
    });

    test('should return undefined for non-existent field', () => {
      const value = readSessionField(session.sessionId, 'non_existent_field');
      expect(value).toBeUndefined();
    });

    test('should return undefined for nested non-existent field', () => {
      const value = readSessionField(session.sessionId, 'options.non_existent');
      expect(value).toBeUndefined();
    });
  });

  describe('updateSession', () => {
    test('should update session data', async () => {
      await updateSession(session.sessionId, (session) => {
        session.phase = 'EXECUTION';
        return session;
      });

      const updated = readSession(session.sessionId);
      expect(updated.phase).toBe('EXECUTION');
    });

    test('should update timestamp', async () => {
      const before = readSession(session.sessionId);

      await new Promise(resolve => setTimeout(resolve, 100));

      await updateSession(session.sessionId, (session) => {
        session.iteration = 2;
        return session;
      });

      const after = readSession(session.sessionId);
      expect(after.updated_at).not.toBe(before.updated_at);
    });

    test('should handle concurrent updates with locking', async () => {
      let counter = 0;

      const increment = async () => {
        await updateSession(session.sessionId, (session) => {
          const current = counter;
          counter = current + 1;
          session.iteration = counter;
          return session;
        });
      };

      // Run 3 concurrent updates
      await Promise.all([increment(), increment(), increment()]);

      const updated = readSession(session.sessionId);
      expect(updated.iteration).toBe(3);
    });

    test('should throw error for non-existent session', async () => {
      let error = null;
      try {
        await updateSession('non-existent', (session) => session);
      } catch (e) {
        error = e;
      }
      expect(error).not.toBeNull();
      expect(error.message).toContain('Session not found');
    });
  });

  describe('getClaudeSessionId', () => {
    test('should return session ID from environment', () => {
      process.env.ULTRAWORK_STDIN_SESSION_ID = 'env-session-123';

      const sessionId = getClaudeSessionId();
      expect(sessionId).toBe('env-session-123');

      delete process.env.ULTRAWORK_STDIN_SESSION_ID;
    });

    test('should return undefined when not set', () => {
      delete process.env.ULTRAWORK_STDIN_SESSION_ID;

      const sessionId = getClaudeSessionId();
      expect(sessionId).toBeUndefined();
    });
  });

  describe('getCurrentSessionFile', () => {
    test('should return session file when valid session in environment', () => {
      process.env.ULTRAWORK_STDIN_SESSION_ID = session.sessionId;

      const sessionFile = getCurrentSessionFile();
      expect(sessionFile).toBe(session.sessionFile);

      delete process.env.ULTRAWORK_STDIN_SESSION_ID;
    });

    test('should return undefined when no session in environment', () => {
      delete process.env.ULTRAWORK_STDIN_SESSION_ID;

      const sessionFile = getCurrentSessionFile();
      expect(sessionFile).toBeUndefined();
    });

    test('should return undefined when session does not exist', () => {
      process.env.ULTRAWORK_STDIN_SESSION_ID = 'non-existent-session';

      const sessionFile = getCurrentSessionFile();
      expect(sessionFile).toBeUndefined();

      delete process.env.ULTRAWORK_STDIN_SESSION_ID;
    });
  });

  describe('getCurrentSessionId', () => {
    test('should be alias for getClaudeSessionId', () => {
      process.env.ULTRAWORK_STDIN_SESSION_ID = 'test-session-456';

      const id1 = getClaudeSessionId();
      const id2 = getCurrentSessionId();
      expect(id1).toBe(id2);

      delete process.env.ULTRAWORK_STDIN_SESSION_ID;
    });
  });

  describe('cleanupOldSessions', () => {
    test('should not delete recent sessions', () => {
      cleanupOldSessions(7);

      expect(fs.existsSync(session.sessionDir)).toBe(true);
    });

    test('should delete old completed sessions', () => {
      // Create a separate test session for cleanup
      const oldSession = createMockSession('old-test-session', 'COMPLETE');

      // Modify mtime to make it old (simulate old session)
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      fs.utimesSync(oldSession.sessionDir, oldDate, oldDate);

      cleanupOldSessions(7);

      expect(fs.existsSync(oldSession.sessionDir)).toBe(false);
    });

    test('should not delete old active sessions', () => {
      // Create a separate test session for this test
      const oldSession = createMockSession('old-active-session', 'PLANNING');

      // Make it old
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      fs.utimesSync(oldSession.sessionDir, oldDate, oldDate);

      cleanupOldSessions(7);

      expect(fs.existsSync(oldSession.sessionDir)).toBe(true);

      // Cleanup
      oldSession.cleanup();
    });

    test('should handle non-existent sessions directory', () => {
      // Just call it without error - doesn't throw
      expect(() => cleanupOldSessions(7)).not.toThrow();
    });
  });

  describe('exports', () => {
    test('should export all required functions', () => {
      const sessionUtils = require('../../../plugins/ultrawork/src/lib/session-utils.js');

      expect(typeof sessionUtils.getUltraworkBase).toBe('function');
      expect(typeof sessionUtils.getSessionsDir).toBe('function');
      expect(typeof sessionUtils.getSessionDir).toBe('function');
      expect(typeof sessionUtils.getSessionFile).toBe('function');
      expect(typeof sessionUtils.resolveSessionId).toBe('function');
      expect(typeof sessionUtils.isSessionActive).toBe('function');
      expect(typeof sessionUtils.listActiveSessions).toBe('function');
      expect(typeof sessionUtils.readSession).toBe('function');
      expect(typeof sessionUtils.readSessionField).toBe('function');
      expect(typeof sessionUtils.updateSession).toBe('function');
      expect(typeof sessionUtils.getClaudeSessionId).toBe('function');
      expect(typeof sessionUtils.getCurrentSessionFile).toBe('function');
      expect(typeof sessionUtils.cleanupOldSessions).toBe('function');
      expect(typeof sessionUtils.getCurrentSessionId).toBe('function');
    });
  });
});
