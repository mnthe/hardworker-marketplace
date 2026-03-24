#!/usr/bin/env bun
/**
 * Tests for task-create.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertJsonSchema, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/task-create.js');

describe('task-create.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-task-create', { phase: 'EXECUTION' });
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--id', '--subject', '--criteria']);
    });
  });

  describe('create basic task', () => {
    test('should create task with required fields', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1',
        '--subject', 'Test task'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK: Task 1 created');

      const parsed = assertJsonSchema(result.stdout.split('\n').slice(1).join('\n'), {
        id: 'string',
        subject: 'string',
        complexity: 'string',
        status: 'string',
        evidence: 'array',
        criteria: 'array'
      });

      expect(parsed.id).toBe('1');
      expect(parsed.subject).toBe('Test task');
      expect(parsed.status).toBe('open');
      expect(parsed.complexity).toBe('standard');
    });

    test('should create task file in tasks directory', async () => {
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'test-id',
        '--subject', 'File test'
      ]);

      const taskFile = path.join(session.sessionDir, 'tasks', 'test-id.json');
      expect(fs.existsSync(taskFile)).toBe(true);
    });
  });

  describe('task fields', () => {
    test('should set description', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '2',
        '--subject', 'Task with description',
        '--description', 'Detailed description'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.description).toBe('Detailed description');
    });

    test('should set complexity', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '3',
        '--subject', 'Complex task',
        '--complexity', 'complex'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.complexity).toBe('complex');
    });

    test('should parse criteria from pipe-separated string', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '4',
        '--subject', 'Task with criteria',
        '--criteria', 'Criterion 1|Criterion 2|Criterion 3'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.criteria).toEqual(['Criterion 1', 'Criterion 2', 'Criterion 3']);
    });

    test('should parse blocked-by from comma-separated string', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '5',
        '--subject', 'Blocked task',
        '--blocked-by', '1,2,3'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.blocked_by).toEqual(['1', '2', '3']);
    });
  });

  describe('TDD support', () => {
    test('should set approach to tdd', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '6',
        '--subject', 'TDD task',
        '--approach', 'tdd'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.approach).toBe('tdd');
    });

    test('should set test file for TDD task', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '7',
        '--subject', 'TDD with test file',
        '--approach', 'tdd',
        '--test-file', 'tests/feature.test.ts'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.test_file).toBe('tests/feature.test.ts');
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--id', '1',
        '--subject', 'Test'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail when task ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--subject', 'Test'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--id');
    });

    test('should fail when subject missing', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '1'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--subject');
    });

    test('should fail for invalid complexity', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '8',
        '--subject', 'Invalid complexity',
        '--complexity', 'invalid'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid complexity');
    });

    test('should fail for test-file with non-tdd approach', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', '9',
        '--subject', 'Test file without TDD',
        '--test-file', 'test.ts',
        '--approach', 'standard'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--test-file requires --approach tdd');
    });

    test('should fail for duplicate task ID', async () => {
      // Create first task
      await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'duplicate',
        '--subject', 'First task'
      ]);

      // Try to create duplicate
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'duplicate',
        '--subject', 'Second task'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('already exists');
    });
  });

  describe('--description-file support', () => {
    test('should read description from file', async () => {
      // Create a temp file with description content
      const descFile = path.join(session.sessionDir, 'desc.txt');
      fs.writeFileSync(descFile, 'Description from file content', 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'df-1',
        '--subject', 'Task with description file',
        '--description-file', descFile
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.description).toBe('Description from file content');
    });

    test('should trim whitespace from file content', async () => {
      const descFile = path.join(session.sessionDir, 'desc-ws.txt');
      fs.writeFileSync(descFile, '  Description with whitespace  \n\n', 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'df-2',
        '--subject', 'Task with trimmed description',
        '--description-file', descFile
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.description).toBe('Description with whitespace');
    });

    test('should fail when file does not exist', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'df-3',
        '--subject', 'Task with missing file',
        '--description-file', '/nonexistent/path/desc.txt'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('does not exist');
    });

    test('should fail when both --description and --description-file are provided', async () => {
      const descFile = path.join(session.sessionDir, 'desc-conflict.txt');
      fs.writeFileSync(descFile, 'File description', 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'df-4',
        '--subject', 'Task with conflict',
        '--description', 'Inline description',
        '--description-file', descFile
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--description');
      expect(result.stderr).toContain('--description-file');
    });

    test('should support -D alias for --description-file', async () => {
      const descFile = path.join(session.sessionDir, 'desc-alias.txt');
      fs.writeFileSync(descFile, 'Alias description', 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'df-5',
        '--subject', 'Task with alias',
        '-D', descFile
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.description).toBe('Alias description');
    });
  });

  describe('alias support', () => {
    test('should support --task alias for --id', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--task', 'alias-test',
        '--subject', 'Alias test'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.split('\n').slice(1).join('\n'));
      expect(parsed.id).toBe('alias-test');
    });
  });

  describe('doc-review gate', () => {
    let planningSession;
    const docResultPath = (sid) => `/tmp/codex-doc-${sid}.json`;

    beforeEach(() => {
      planningSession = createMockSession('test-task-create-gate', { phase: 'PLANNING' });
    });

    afterEach(() => {
      planningSession.cleanup();
      // Clean up any doc-review result files
      const resultPath = docResultPath(planningSession.sessionId);
      if (fs.existsSync(resultPath)) {
        fs.unlinkSync(resultPath);
      }
    });

    test('PLANNING + PASS result → task created', async () => {
      const resultPath = docResultPath(planningSession.sessionId);
      fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'PASS' }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', planningSession.sessionId,
        '--id', 'gate-pass',
        '--subject', 'Gate pass test'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK: Task gate-pass created');
    });

    test('PLANNING + SKIP result → task created', async () => {
      const resultPath = docResultPath(planningSession.sessionId);
      fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'SKIP' }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', planningSession.sessionId,
        '--id', 'gate-skip',
        '--subject', 'Gate skip test'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK: Task gate-skip created');
    });

    test('PLANNING + FAIL result → exit 1', async () => {
      const resultPath = docResultPath(planningSession.sessionId);
      fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'FAIL' }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', planningSession.sessionId,
        '--id', 'gate-fail',
        '--subject', 'Gate fail test'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Codex doc-review returned FAIL');
    });

    test('PLANNING + no result + Codex installed → exit 1', async () => {
      // No result file exists, and Codex is installed on this machine
      const result = await runScript(SCRIPT_PATH, [
        '--session', planningSession.sessionId,
        '--id', 'gate-no-result',
        '--subject', 'Gate no result test'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Codex doc-review must pass before creating tasks');
    });

    test('PLANNING + unknown verdict → exit 1', async () => {
      const resultPath = docResultPath(planningSession.sessionId);
      fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'UNKNOWN' }), 'utf-8');

      const result = await runScript(SCRIPT_PATH, [
        '--session', planningSession.sessionId,
        '--id', 'gate-unknown',
        '--subject', 'Gate unknown verdict test'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Codex doc-review returned FAIL');
    });

    test('EXECUTION phase → gate skip (task created)', async () => {
      // session fixture already uses EXECUTION phase
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--id', 'gate-execution',
        '--subject', 'Execution phase test'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('OK: Task gate-execution created');
    });
  });
});
