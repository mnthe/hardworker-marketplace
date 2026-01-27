#!/usr/bin/env bun
/**
 * Tests for mailbox-send.js
 */

const { test, expect, describe, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/mailbox-send.js');

describe('mailbox-send.js', () => {
  let cleanup;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('mailbox-send');
  });

  test('sends text message successfully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      from: 'w1',
      to: 'orchestrator',
      type: 'text',
      payload: 'Task complete'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Message sent');

    // Verify inbox file was created
    const inboxFile = path.join(mock.projectDir, 'inboxes', 'orchestrator.json');
    expect(fs.existsSync(inboxFile)).toBe(true);

    // Verify message content
    const inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
    expect(inbox.messages).toHaveLength(1);
    expect(inbox.messages[0].from).toBe('w1');
    expect(inbox.messages[0].to).toBe('orchestrator');
    expect(inbox.messages[0].type).toBe('text');
    expect(inbox.messages[0].payload).toBe('Task complete');
    expect(inbox.messages[0].read).toBe(false);
  });

  test('sends idle_notification successfully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const payload = JSON.stringify({ worker_id: 'w1', completed_task_id: '3' });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      from: 'w1',
      to: 'orchestrator',
      type: 'idle_notification',
      payload: payload
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Message sent');

    // Verify message content
    const inboxFile = path.join(mock.projectDir, 'inboxes', 'orchestrator.json');
    const inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
    expect(inbox.messages).toHaveLength(1);
    expect(inbox.messages[0].type).toBe('idle_notification');
    expect(inbox.messages[0].payload).toEqual({ worker_id: 'w1', completed_task_id: '3' });
  });

  test('sends shutdown_request successfully', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      from: 'orchestrator',
      to: 'w1',
      type: 'shutdown_request',
      payload: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OK: Message sent');

    // Verify message content
    const inboxFile = path.join(mock.projectDir, 'inboxes', 'w1.json');
    const inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
    expect(inbox.messages).toHaveLength(1);
    expect(inbox.messages[0].type).toBe('shutdown_request');
  });

  test('fails without required --project parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      team: 'test-team',
      from: 'w1',
      to: 'orchestrator',
      type: 'text',
      payload: 'message'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --team parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      from: 'w1',
      to: 'orchestrator',
      type: 'text',
      payload: 'message'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --from parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      to: 'orchestrator',
      type: 'text',
      payload: 'message'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --to parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      from: 'w1',
      type: 'text',
      payload: 'message'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --type parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      from: 'w1',
      to: 'orchestrator',
      payload: 'message'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --payload parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      from: 'w1',
      to: 'orchestrator',
      type: 'text'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('validates message type', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      from: 'w1',
      to: 'orchestrator',
      type: 'invalid_type',
      payload: 'message'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid type');
  });

  test('parses JSON payload correctly', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const payload = JSON.stringify({ key: 'value', number: 42 });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      from: 'w1',
      to: 'orchestrator',
      type: 'idle_notification',
      payload: payload
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);

    // Verify parsed JSON
    const inboxFile = path.join(mock.projectDir, 'inboxes', 'orchestrator.json');
    const inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
    expect(inbox.messages[0].payload).toEqual({ key: 'value', number: 42 });
  });
});
