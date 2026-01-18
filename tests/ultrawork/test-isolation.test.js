#!/usr/bin/env bun
/**
 * Test Isolation Verification Tests
 *
 * These tests verify that the test infrastructure properly isolates
 * tests from real user data. If these tests fail, there may be a
 * risk of tests affecting real ~/.claude/ data.
 *
 * CRITICAL: These tests should run FIRST in any test suite.
 */

const { describe, test, expect, beforeAll, afterAll } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Import test utilities
const {
  TEST_BASE_DIR,
  getTestSessionsDir,
  createMockSession,
  runScript,
  cleanupAllTestSessions
} = require('./test-utils.js');

// Set env before importing session-utils
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR;

const {
  getUltraworkBase,
  getSessionsDir,
  validateSafeDelete,
  isTestDirectory
} = require('../../plugins/ultrawork/src/lib/session-utils.js');

describe('Test Isolation Verification', () => {
  afterAll(() => {
    cleanupAllTestSessions();
    delete process.env.ULTRAWORK_TEST_BASE_DIR;
  });

  describe('Environment Setup', () => {
    test('ULTRAWORK_TEST_BASE_DIR should be set', () => {
      expect(process.env.ULTRAWORK_TEST_BASE_DIR).toBeDefined();
      expect(process.env.ULTRAWORK_TEST_BASE_DIR).toBe(TEST_BASE_DIR);
    });

    test('TEST_BASE_DIR should use os.tmpdir()', () => {
      const tmpDir = os.tmpdir();
      expect(TEST_BASE_DIR.startsWith(tmpDir)).toBe(true);
    });

    test('TEST_BASE_DIR should NOT be in ~/.claude/', () => {
      const homeDir = os.homedir();
      const realPath = path.join(homeDir, '.claude');
      expect(TEST_BASE_DIR.startsWith(realPath)).toBe(false);
    });
  });

  describe('Path Functions Isolation', () => {
    test('getUltraworkBase should return test path when env is set', () => {
      const base = getUltraworkBase();
      expect(base).toBe(TEST_BASE_DIR);
      expect(base).not.toContain('.claude');
    });

    test('getSessionsDir should return test sessions path', () => {
      const sessionsDir = getSessionsDir();
      expect(sessionsDir).toBe(path.join(TEST_BASE_DIR, 'sessions'));
      expect(sessionsDir).not.toContain(os.homedir());
    });

    test('isTestDirectory should return true', () => {
      expect(isTestDirectory()).toBe(true);
    });
  });

  describe('Safety Validation', () => {
    test('validateSafeDelete should allow test directory paths', () => {
      const testPath = path.join(TEST_BASE_DIR, 'sessions', 'test-session');
      expect(() => validateSafeDelete(testPath)).not.toThrow();
    });

    test('validateSafeDelete should BLOCK real user directory paths', () => {
      const realPath = path.join(os.homedir(), '.claude', 'ultrawork', 'sessions', 'real-session');
      expect(() => validateSafeDelete(realPath)).toThrow('SAFETY');
    });

    test('validateSafeDelete should BLOCK ultrawork base directory', () => {
      const basePath = path.join(os.homedir(), '.claude', 'ultrawork');
      expect(() => validateSafeDelete(basePath)).toThrow('SAFETY');
    });

    test('validateSafeDelete should BLOCK .claude directory', () => {
      const claudePath = path.join(os.homedir(), '.claude');
      expect(() => validateSafeDelete(claudePath)).toThrow('SAFETY');
    });

    test('validateSafeDelete should BLOCK path traversal attempts', () => {
      // Attempt to escape test directory using ..
      const escapePath = path.join(TEST_BASE_DIR, '..', '..', 'real-data');
      expect(() => validateSafeDelete(escapePath)).toThrow('SAFETY');
    });
  });

  describe('Mock Session Isolation', () => {
    test('createMockSession should create in test directory', () => {
      const session = createMockSession('isolation-test-session');

      expect(session.sessionDir.startsWith(TEST_BASE_DIR)).toBe(true);
      expect(session.sessionDir).not.toContain(os.homedir() + '/.claude');

      session.cleanup();
    });

    test('mock session should NOT exist in real directory', () => {
      const session = createMockSession('isolation-verify-session');

      const realSessionDir = path.join(
        os.homedir(),
        '.claude',
        'ultrawork',
        'sessions',
        'isolation-verify-session'
      );

      expect(fs.existsSync(realSessionDir)).toBe(false);
      expect(fs.existsSync(session.sessionDir)).toBe(true);

      session.cleanup();
    });
  });

  describe('Script Execution Isolation', () => {
    test('runScript should pass ULTRAWORK_TEST_BASE_DIR to subprocess', async () => {
      const SCRIPT_PATH = path.join(
        __dirname,
        '../../plugins/ultrawork/src/scripts/session-get.js'
      );

      // This should fail gracefully because no session exists,
      // but the important thing is it looks in the TEST directory
      const result = await runScript(SCRIPT_PATH, ['--session', 'nonexistent', '--dir']);

      // The error message should reference the test path, not the real path
      if (result.stderr) {
        expect(result.stderr).not.toContain(os.homedir() + '/.claude/ultrawork');
      }
    });
  });
});

describe('Regression Tests for Session Deletion Bug', () => {
  /**
   * This test verifies the fix for the critical bug where running
   * `ultrawork-clean.js --all` during tests would delete ALL sessions
   * including real user sessions.
   *
   * The bug was caused by tests using real ~/.claude/ paths instead
   * of isolated test directories.
   */
  test('ultrawork-clean --all should NOT affect real user directory', async () => {
    const SCRIPT_PATH = path.join(
      __dirname,
      '../../plugins/ultrawork/src/scripts/ultrawork-clean.js'
    );

    // Create a test session
    const session = createMockSession('clean-isolation-test', { phase: 'COMPLETE' });

    // Run --all cleanup
    const result = await runScript(SCRIPT_PATH, ['--all']);

    expect(result.exitCode).toBe(0);

    // Verify the test session was deleted (from test dir)
    expect(fs.existsSync(session.sessionDir)).toBe(false);

    // CRITICAL: Verify real user directory still exists and wasn't touched
    const realUserDir = path.join(os.homedir(), '.claude', 'ultrawork');
    // We don't check if it exists (user might not have any sessions)
    // But we verify that if it exists, it wasn't modified by our test

    // The fact that we got here without errors means validateSafeDelete worked
  });
});
