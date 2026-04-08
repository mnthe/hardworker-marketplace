#!/usr/bin/env bun
/**
 * Tests for task-create.js - doc-review gate made advisory
 *
 * Verifies that task creation during PLANNING phase is allowed
 * when doc-review result file is missing (advisory, not blocking).
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/task-create.js');

describe('task-create.js - advisory doc-review gate', () => {
  let session;
  const docResultPath = (sid) => `/tmp/codex-doc-${sid}.json`;

  beforeEach(() => {
    session = createMockSession('test-task-advisory-gate', { phase: 'PLANNING' });
  });

  afterEach(() => {
    session.cleanup();
    const resultPath = docResultPath(session.sessionId);
    if (fs.existsSync(resultPath)) {
      fs.unlinkSync(resultPath);
    }
  });

  test('PLANNING + no result file -> task created (advisory, no longer blocking)', async () => {
    // No result file exists - previously this would block, now it should allow
    const result = await runScript(SCRIPT_PATH, [
      '--session', session.sessionId,
      '--id', 'advisory-1',
      '--subject', 'Advisory gate test'
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Task advisory-1 created');
  });

  test('PLANNING + FAIL result -> still blocks (quality check preserved)', async () => {
    const resultPath = docResultPath(session.sessionId);
    fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'FAIL' }), 'utf-8');

    const result = await runScript(SCRIPT_PATH, [
      '--session', session.sessionId,
      '--id', 'advisory-2',
      '--subject', 'Fail result test'
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Codex doc-review returned FAIL');
  });

  test('PLANNING + PASS result -> task created', async () => {
    const resultPath = docResultPath(session.sessionId);
    fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'PASS' }), 'utf-8');

    const result = await runScript(SCRIPT_PATH, [
      '--session', session.sessionId,
      '--id', 'advisory-3',
      '--subject', 'Pass result test'
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Task advisory-3 created');
  });

  test('PLANNING + SKIP result -> task created', async () => {
    const resultPath = docResultPath(session.sessionId);
    fs.writeFileSync(resultPath, JSON.stringify({ verdict: 'SKIP' }), 'utf-8');

    const result = await runScript(SCRIPT_PATH, [
      '--session', session.sessionId,
      '--id', 'advisory-4',
      '--subject', 'Skip result test'
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Task advisory-4 created');
  });
});
