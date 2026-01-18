#!/usr/bin/env bun
/**
 * Tests for setup-ultrawork.js
 */

const { describe, test, expect, afterEach } = require('bun:test');
const { runScript, assertHelpText } = require('./test-utils.js');
const { getSessionDir, getSessionFile, readSession } = require('../../plugins/ultrawork/src/lib/session-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/setup-ultrawork.js');

describe('setup-ultrawork.js', () => {
  const testSessionId = 'test-setup-session';
  const sessionDir = getSessionDir(testSessionId);

  afterEach(() => {
    // Cleanup test session
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--goal', '--max-workers', '--auto']);
    });
  });

  describe('create session', () => {
    test('should create session with goal', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'Test goal'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ULTRAWORK SESSION STARTED');
      expect(result.stdout).toContain('Test goal');

      // Verify session file created
      const sessionFile = getSessionFile(testSessionId);
      expect(fs.existsSync(sessionFile)).toBe(true);

      // Verify session data
      const session = readSession(testSessionId);
      expect(session.session_id).toBe(testSessionId);
      expect(session.goal).toBe('Test goal');
      expect(session.phase).toBe('PLANNING');
    });

    test('should create session directory structure', async () => {
      await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'Test structure'
      ]);

      expect(fs.existsSync(path.join(sessionDir, 'tasks'))).toBe(true);
      expect(fs.existsSync(path.join(sessionDir, 'exploration'))).toBe(true);
      expect(fs.existsSync(path.join(sessionDir, 'context.json'))).toBe(true);
    });

    test('should set options from flags', async () => {
      await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'Options test',
        '--max-workers', '3',
        '--max-iterations', '10',
        '--skip-verify',
        '--auto'
      ]);

      const session = readSession(testSessionId);
      expect(parseInt(session.options.max_workers, 10)).toBe(3);
      expect(parseInt(session.options.max_iterations, 10)).toBe(10);
      expect(session.options.skip_verify).toBe(true);
      expect(session.options.auto_mode).toBe(true);
    });

    test('should set plan-only mode', async () => {
      await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'Plan only test',
        '--plan-only'
      ]);

      const session = readSession(testSessionId);
      expect(session.options.plan_only).toBe(true);
    });
  });

  describe('working directory', () => {
    test('should set working_dir to current directory', async () => {
      await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'Working dir test'
      ]);

      const session = readSession(testSessionId);
      expect(session.working_dir).toBeTruthy();
      expect(typeof session.working_dir).toBe('string');
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, ['--goal', 'Test']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail when goal missing', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', testSessionId]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('goal');
    });

    test('should fail for existing active session without --force', async () => {
      // Create initial session
      await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'First session'
      ]);

      // Try to create again without --force
      const result = await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'Second session'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Active session exists');
    });

    test('should allow recreation with --force', async () => {
      // Create initial session
      await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'First session'
      ]);

      // Recreate with --force
      const result = await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'Forced session',
        '--force'
      ]);

      expect(result.exitCode).toBe(0);

      const session = readSession(testSessionId);
      expect(session.goal).toBe('Forced session');
    });
  });

  describe('context.json creation', () => {
    test('should create empty context.json', async () => {
      await runScript(SCRIPT_PATH, [
        '--session', testSessionId,
        '--goal', 'Context test'
      ]);

      const contextFile = path.join(sessionDir, 'context.json');
      expect(fs.existsSync(contextFile)).toBe(true);

      const context = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
      expect(context.explorers).toEqual([]);
      expect(context.exploration_complete).toBe(false);
    });
  });

  describe('generateBranchName()', () => {
    const { generateBranchName } = require(SCRIPT_PATH);

    test('should generate date-first format (YYYY-MM-DD-{brief})', () => {
      const result = generateBranchName('Implement user authentication');

      // Verify it starts with ultrawork/ prefix
      expect(result).toMatch(/^ultrawork\//);

      // Verify date format YYYY-MM-DD appears after prefix
      expect(result).toMatch(/^ultrawork\/\d{4}-\d{2}-\d{2}-/);

      // Verify brief part exists
      expect(result).toMatch(/^ultrawork\/\d{4}-\d{2}-\d{2}-.+/);
    });

    test('should truncate brief to 30 characters', () => {
      const longGoal = 'This is a very long goal description that should be truncated to fit the 30 character limit';
      const result = generateBranchName(longGoal);

      // Extract brief part (everything after the date)
      const match = result.match(/^ultrawork\/\d{4}-\d{2}-\d{2}-(.+)$/);
      expect(match).toBeTruthy();

      const brief = match[1];
      expect(brief.length).toBeLessThanOrEqual(30);
    });

    test('should remove special characters', () => {
      const goalWithSpecialChars = 'Add @user #authentication & $validation!';
      const result = generateBranchName(goalWithSpecialChars);

      // Extract brief part
      const match = result.match(/^ultrawork\/\d{4}-\d{2}-\d{2}-(.+)$/);
      expect(match).toBeTruthy();

      const brief = match[1];
      // Brief should only contain lowercase letters, numbers, and hyphens
      expect(brief).toMatch(/^[a-z0-9-]+$/);
      expect(brief).toContain('add');
      expect(brief).toContain('user');
      expect(brief).toContain('authentication');
    });

    test('should remove trailing hyphens', () => {
      const goalEndingWithSpaces = 'Test goal with spaces   ';
      const result = generateBranchName(goalEndingWithSpaces);

      // Extract brief part
      const match = result.match(/^ultrawork\/\d{4}-\d{2}-\d{2}-(.+)$/);
      expect(match).toBeTruthy();

      const brief = match[1];
      // Brief should not end with a hyphen
      expect(brief).not.toMatch(/-$/);
    });

    test('should convert spaces to single hyphens', () => {
      const goalWithSpaces = 'add user  authentication   system';
      const result = generateBranchName(goalWithSpaces);

      // Extract brief part
      const match = result.match(/^ultrawork\/\d{4}-\d{2}-\d{2}-(.+)$/);
      expect(match).toBeTruthy();

      const brief = match[1];
      // Should have single hyphens, no consecutive hyphens
      expect(brief).not.toMatch(/--/);
      expect(brief).toBe('add-user-authentication-system');
    });

    test('should handle goal with only special characters gracefully', () => {
      const specialCharsOnly = '@#$%^&*()!';
      const result = generateBranchName(specialCharsOnly);

      // Should still have valid format with empty or minimal brief
      expect(result).toMatch(/^ultrawork\/\d{4}-\d{2}-\d{2}/);

      // Extract brief part (might be empty or just have remaining valid chars)
      const match = result.match(/^ultrawork\/\d{4}-\d{2}-\d{2}-?(.*)$/);
      expect(match).toBeTruthy();
    });

    test('should use current date', () => {
      const result = generateBranchName('test goal');

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Verify the result contains today's date
      expect(result).toContain(today);
    });

    test('should lowercase the goal text', () => {
      const mixedCaseGoal = 'Add USER Authentication System';
      const result = generateBranchName(mixedCaseGoal);

      // Extract brief part
      const match = result.match(/^ultrawork\/\d{4}-\d{2}-\d{2}-(.+)$/);
      expect(match).toBeTruthy();

      const brief = match[1];
      // Should be all lowercase
      expect(brief).toBe(brief.toLowerCase());
      expect(brief).toContain('user');
      expect(brief).not.toContain('USER');
    });
  });
});
