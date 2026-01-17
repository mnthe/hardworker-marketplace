#!/usr/bin/env bun
/**
 * Tests for evidence-summary.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, createMockTask, runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/evidence-summary.js');

describe('evidence-summary.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-evidence-summary');

    // Create tasks
    createMockTask(session.sessionId, '1', {
      subject: 'Task 1',
      status: 'resolved',
      criteria: ['Criterion 1'],
      evidence: ['Evidence 1']
    });

    // Create evidence directory and JSONL
    const evidenceDir = path.join(session.sessionDir, 'evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });

    const evidenceLog = path.join(evidenceDir, 'log.jsonl');
    const entries = [
      {
        type: 'command_execution',
        timestamp: new Date().toISOString(),
        command: 'npm test',
        exit_code: 0
      }
    ];

    fs.writeFileSync(evidenceLog, entries.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session', '--format', '--save']);
    });
  });

  describe('markdown format', () => {
    test('should generate markdown summary', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('# Evidence Summary');
      expect(result.stdout).toContain('Evidence Summary');
    });

    test('should include task information', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Task 1');
    });
  });

  describe('JSON format', () => {
    test('should generate JSON summary', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--format', 'json'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      // JSON format returns array of tasks (from readAllTasks)
      expect(Array.isArray(parsed) || typeof parsed === 'object').toBe(true);
    });
  });

  describe('save mode', () => {
    test('should save summary to evidence/index.md', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', session.sessionId,
        '--save'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Saved to:');

      const indexFile = path.join(session.sessionDir, 'evidence', 'index.md');
      expect(fs.existsSync(indexFile)).toBe(true);
    });
  });

  describe('error cases', () => {
    test('should fail when session ID missing', async () => {
      const result = await runScript(SCRIPT_PATH, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--session');
    });

    test('should fail for non-existent session', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--session', 'non-existent'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });
});
