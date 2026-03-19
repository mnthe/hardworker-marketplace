#!/usr/bin/env bun
/**
 * Tests for deterministic-verify.js (RED phase - script does not exist yet)
 *
 * deterministic-verify.js runs rule-based verification checks against a session.
 * Check types: task_status, evidence_count, command, glob
 * Rules: default (phase-rules.json) merged with project (.claude/ultrawork-rules.json)
 * Output: JSON with verdict (PASS/FAIL) and per-check results
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, createMockTask, runScript, assertHelpText, TEST_BASE_DIR } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/deterministic-verify.js');

describe('deterministic-verify.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-det-verify', {
      phase: 'VERIFICATION',
      working_dir: path.join(TEST_BASE_DIR, 'test-project')
    });
    // Create the working dir so glob checks can use it
    fs.mkdirSync(path.join(TEST_BASE_DIR, 'test-project'), { recursive: true });
  });

  afterEach(() => {
    session.cleanup();
    const projectDir = path.join(TEST_BASE_DIR, 'test-project');
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 1. Help flag
  // =========================================================================
  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session']);
    });
  });

  // =========================================================================
  // 2. Missing --session
  // =========================================================================
  describe('missing parameters', () => {
    test('should fail when --session is missing', async () => {
      const result = await runScript(SCRIPT_PATH, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });
  });

  // =========================================================================
  // 3. task_status check PASS
  // =========================================================================
  describe('task_status check', () => {
    test('should PASS when all tasks are resolved', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });
      createMockTask(session.sessionId, '2', { status: 'resolved' });
      createMockTask(session.sessionId, 'verify', { status: 'resolved' });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      // Find the task_status check result
      const taskCheck = parsed.checks.find(c => c.type === 'task_status');
      expect(taskCheck).toBeDefined();
      expect(taskCheck.passed).toBe(true);
    });

    // =========================================================================
    // 4. task_status check FAIL
    // =========================================================================
    test('should FAIL when any task is not resolved', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });
      createMockTask(session.sessionId, '2', { status: 'open' });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const taskCheck = parsed.checks.find(c => c.type === 'task_status');
      expect(taskCheck).toBeDefined();
      expect(taskCheck.passed).toBe(false);
    });
  });

  // =========================================================================
  // 5. evidence_count check PASS
  // =========================================================================
  describe('evidence_count check', () => {
    test('should PASS when evidence log has matching entries', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      // Create evidence log with test_result entry
      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      const logPath = path.join(evidenceDir, 'log.jsonl');
      const entries = [
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        JSON.stringify({ type: 'command_execution', timestamp: '2026-03-19T00:01:00Z', command: 'npm test' })
      ];
      fs.writeFileSync(logPath, entries.join('\n'), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const evidenceCheck = parsed.checks.find(c => c.type === 'evidence_count');
      expect(evidenceCheck).toBeDefined();
      expect(evidenceCheck.passed).toBe(true);
    });

    // =========================================================================
    // 6. evidence_count check FAIL
    // =========================================================================
    test('should FAIL when evidence log has no matching entries', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      // Create evidence log WITHOUT test_result entries
      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      const logPath = path.join(evidenceDir, 'log.jsonl');
      const entries = [
        JSON.stringify({ type: 'command_execution', timestamp: '2026-03-19T00:00:00Z', command: 'ls' })
      ];
      fs.writeFileSync(logPath, entries.join('\n'), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const evidenceCheck = parsed.checks.find(c => c.type === 'evidence_count');
      expect(evidenceCheck).toBeDefined();
      expect(evidenceCheck.passed).toBe(false);
    });
  });

  // =========================================================================
  // 7. command check PASS
  // =========================================================================
  describe('command check', () => {
    test('should PASS when command exits 0', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      // Create evidence to satisfy default rules
      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDir, 'log.jsonl'),
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        'utf-8'
      );

      // Create project-level rules with a command check that always succeeds
      const projectDir = path.join(TEST_BASE_DIR, 'test-project');
      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'ultrawork-rules.json'), JSON.stringify({
        version: '1',
        checks: [
          {
            name: 'always_true',
            type: 'command',
            command: 'true',
            message: 'Command should succeed'
          }
        ]
      }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const cmdCheck = parsed.checks.find(c => c.name === 'always_true');
      expect(cmdCheck).toBeDefined();
      expect(cmdCheck.passed).toBe(true);
    });

    // =========================================================================
    // 8. command check FAIL
    // =========================================================================
    test('should FAIL when command exits non-zero', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDir, 'log.jsonl'),
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        'utf-8'
      );

      const projectDir = path.join(TEST_BASE_DIR, 'test-project');
      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'ultrawork-rules.json'), JSON.stringify({
        version: '1',
        checks: [
          {
            name: 'always_false',
            type: 'command',
            command: 'false',
            message: 'Command should fail'
          }
        ]
      }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const cmdCheck = parsed.checks.find(c => c.name === 'always_false');
      expect(cmdCheck).toBeDefined();
      expect(cmdCheck.passed).toBe(false);
    });

    // =========================================================================
    // 9. command check timeout
    // =========================================================================
    test('should FAIL when command exceeds timeout', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDir, 'log.jsonl'),
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        'utf-8'
      );

      const projectDir = path.join(TEST_BASE_DIR, 'test-project');
      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'ultrawork-rules.json'), JSON.stringify({
        version: '1',
        checks: [
          {
            name: 'slow_command',
            type: 'command',
            command: 'sleep 10',
            timeout: 100,
            message: 'Command should timeout'
          }
        ]
      }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const cmdCheck = parsed.checks.find(c => c.name === 'slow_command');
      expect(cmdCheck).toBeDefined();
      expect(cmdCheck.passed).toBe(false);
      expect(cmdCheck.detail).toContain('timeout');
    });
  });

  // =========================================================================
  // 10. glob check PASS
  // =========================================================================
  describe('glob check', () => {
    test('should PASS when files match pattern with min_matches', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDir, 'log.jsonl'),
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        'utf-8'
      );

      // Create files matching the glob pattern
      const projectDir = path.join(TEST_BASE_DIR, 'test-project');
      const srcDir = path.join(projectDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'app.js'), '// app', 'utf-8');
      fs.writeFileSync(path.join(srcDir, 'utils.js'), '// utils', 'utf-8');

      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'ultrawork-rules.json'), JSON.stringify({
        version: '1',
        checks: [
          {
            name: 'js_files_exist',
            type: 'glob',
            pattern: 'src/**/*.js',
            min_matches: 1,
            message: 'JS files should exist in src'
          }
        ]
      }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const globCheck = parsed.checks.find(c => c.name === 'js_files_exist');
      expect(globCheck).toBeDefined();
      expect(globCheck.passed).toBe(true);
    });

    // =========================================================================
    // 11. glob check FAIL
    // =========================================================================
    test('should FAIL when no files match pattern', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDir, 'log.jsonl'),
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        'utf-8'
      );

      const projectDir = path.join(TEST_BASE_DIR, 'test-project');
      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'ultrawork-rules.json'), JSON.stringify({
        version: '1',
        checks: [
          {
            name: 'ts_files_exist',
            type: 'glob',
            pattern: 'src/**/*.ts',
            min_matches: 1,
            message: 'TS files should exist in src'
          }
        ]
      }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const globCheck = parsed.checks.find(c => c.name === 'ts_files_exist');
      expect(globCheck).toBeDefined();
      expect(globCheck.passed).toBe(false);
    });
  });

  // =========================================================================
  // 12. Merge logic - additive
  // =========================================================================
  describe('merge logic', () => {
    test('should merge default rules and project rules with unique names (additive)', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDir, 'log.jsonl'),
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        'utf-8'
      );

      // Project rules with a unique name not in defaults
      const projectDir = path.join(TEST_BASE_DIR, 'test-project');
      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'ultrawork-rules.json'), JSON.stringify({
        version: '1',
        checks: [
          {
            name: 'custom_check',
            type: 'command',
            command: 'true',
            message: 'Custom project check'
          }
        ]
      }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);

      // Should have both default checks and custom check
      const defaultCheck = parsed.checks.find(c => c.name === 'all_tasks_resolved');
      const customCheck = parsed.checks.find(c => c.name === 'custom_check');
      expect(defaultCheck).toBeDefined();
      expect(customCheck).toBeDefined();
    });

    // =========================================================================
    // 13. Merge logic - override
    // =========================================================================
    test('should override default rule when project rule has same name', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDir, 'log.jsonl'),
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        'utf-8'
      );

      // Override the default evidence_exists check with a command check
      const projectDir = path.join(TEST_BASE_DIR, 'test-project');
      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, 'ultrawork-rules.json'), JSON.stringify({
        version: '1',
        checks: [
          {
            name: 'evidence_exists',
            type: 'command',
            command: 'true',
            message: 'Overridden evidence check'
          }
        ]
      }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);

      // The evidence_exists check should now be type 'command', not 'evidence_count'
      const evidenceCheck = parsed.checks.find(c => c.name === 'evidence_exists');
      expect(evidenceCheck).toBeDefined();
      expect(evidenceCheck.type).toBe('command');
    });
  });

  // =========================================================================
  // 14. Overall verdict PASS
  // =========================================================================
  describe('overall verdict', () => {
    test('should return PASS when all checks pass', async () => {
      createMockTask(session.sessionId, '1', { status: 'resolved' });

      const evidenceDir = path.join(session.sessionDir, 'evidence');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDir, 'log.jsonl'),
        JSON.stringify({ type: 'test_result', timestamp: '2026-03-19T00:00:00Z', passed: true }),
        'utf-8'
      );

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.verdict).toBe('PASS');
      expect(parsed.failed).toEqual([]);
    });

    // =========================================================================
    // 15. Overall verdict FAIL
    // =========================================================================
    test('should return FAIL when any check fails', async () => {
      // One task open -> task_status will fail
      createMockTask(session.sessionId, '1', { status: 'open' });

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.verdict).toBe('FAIL');
      expect(parsed.failed.length).toBeGreaterThan(0);
      // The failed array should contain check names
      expect(parsed.failed).toContain('all_tasks_resolved');
    });
  });
});
