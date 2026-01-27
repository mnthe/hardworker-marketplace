#!/usr/bin/env bun
/**
 * Tests for mailbox-read.js CLI script
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mailbox = require('../src/lib/mailbox.js');

// Helper function to run CLI script
function runScript(scriptPath, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [scriptPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

describe('mailbox-read.js', () => {
  let testDir;
  let project;
  let team;
  let scriptPath;

  beforeEach(() => {
    // Create isolated test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailbox-read-test-'));

    // Override base directory for tests
    process.env.TEAMWORK_TEST_BASE_DIR = testDir;

    project = 'test-project';
    team = 'test-team';

    // Script path
    scriptPath = path.join(__dirname, '../src/scripts/mailbox-read.js');

    // Create project directory structure
    const projectDir = path.join(testDir, project, team);
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.TEAMWORK_TEST_BASE_DIR;
  });

  describe('--help flag', () => {
    test('displays usage information', async () => {
      const result = await runScript(scriptPath, ['--help']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('--project');
      expect(result.stdout).toContain('--team');
      expect(result.stdout).toContain('--inbox');
      expect(result.stdout).toContain('--unread-only');
      expect(result.stdout).toContain('--type');
      expect(result.stdout).toContain('--mark-read');
    });
  });

  describe('reading all messages', () => {
    test('reads all messages from inbox', async () => {
      // Setup: Create inbox with messages
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      await mailbox.sendMessage(project, team, {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Message 1'
      });

      await mailbox.sendMessage(project, team, {
        from: 'w2',
        to: inboxName,
        type: 'idle_notification',
        payload: { worker_id: 'w2' }
      });

      // Run script
      const result = await runScript(
        scriptPath,
        ['--project', project, '--team', team, '--inbox', inboxName],
        { TEAMWORK_TEST_BASE_DIR: testDir }
      );

      expect(result.code).toBe(0);

      // Parse JSON output
      const output = JSON.parse(result.stdout);
      expect(output.messages).toBeDefined();
      expect(output.messages.length).toBe(2);
      expect(output.messages[0].from).toBe('w1');
      expect(output.messages[1].from).toBe('w2');
    });

    test('returns empty array for nonexistent inbox', async () => {
      const result = await runScript(
        scriptPath,
        ['--project', project, '--team', team, '--inbox', 'nonexistent'],
        { TEAMWORK_TEST_BASE_DIR: testDir }
      );

      expect(result.code).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.messages).toEqual([]);
    });
  });

  describe('--unread-only filter', () => {
    test('returns only unread messages', async () => {
      // Setup: Create inbox with mix of read/unread messages
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      await mailbox.sendMessage(project, team, {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Message 1'
      });

      await mailbox.sendMessage(project, team, {
        from: 'w2',
        to: inboxName,
        type: 'text',
        payload: 'Message 2'
      });

      // Mark first message as read
      const allMessages = mailbox.readMessages(project, team, inboxName);
      await mailbox.markAsRead(project, team, inboxName, allMessages[0].id);

      // Run script with --unread-only
      const result = await runScript(
        scriptPath,
        ['--project', project, '--team', team, '--inbox', inboxName, '--unread-only'],
        { TEAMWORK_TEST_BASE_DIR: testDir }
      );

      expect(result.code).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.messages.length).toBe(1);
      expect(output.messages[0].payload).toBe('Message 2');
      expect(output.messages[0].read).toBe(false);
    });
  });

  describe('--type filter', () => {
    test('filters messages by type', async () => {
      // Setup: Create inbox with different message types
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      await mailbox.sendMessage(project, team, {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Text message'
      });

      await mailbox.sendMessage(project, team, {
        from: 'w2',
        to: inboxName,
        type: 'idle_notification',
        payload: { worker_id: 'w2' }
      });

      await mailbox.sendMessage(project, team, {
        from: 'w3',
        to: inboxName,
        type: 'idle_notification',
        payload: { worker_id: 'w3' }
      });

      // Run script with --type filter
      const result = await runScript(
        scriptPath,
        ['--project', project, '--team', team, '--inbox', inboxName, '--type', 'idle_notification'],
        { TEAMWORK_TEST_BASE_DIR: testDir }
      );

      expect(result.code).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.messages.length).toBe(2);
      expect(output.messages[0].type).toBe('idle_notification');
      expect(output.messages[1].type).toBe('idle_notification');
    });
  });

  describe('required parameters', () => {
    test('fails when --project is missing', async () => {
      const result = await runScript(
        scriptPath,
        ['--team', team, '--inbox', 'test'],
        { TEAMWORK_TEST_BASE_DIR: testDir }
      );

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('--project');
      expect(result.stderr).toContain('required');
    });

    test('fails when --team is missing', async () => {
      const result = await runScript(
        scriptPath,
        ['--project', project, '--inbox', 'test'],
        { TEAMWORK_TEST_BASE_DIR: testDir }
      );

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('--team');
      expect(result.stderr).toContain('required');
    });

    test('fails when --inbox is missing', async () => {
      const result = await runScript(
        scriptPath,
        ['--project', project, '--team', team],
        { TEAMWORK_TEST_BASE_DIR: testDir }
      );

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('--inbox');
      expect(result.stderr).toContain('required');
    });
  });

  describe('combined filters', () => {
    test('combines --unread-only and --type filters', async () => {
      // Setup: Create inbox with various messages
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      await mailbox.sendMessage(project, team, {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Text 1'
      });

      await mailbox.sendMessage(project, team, {
        from: 'w2',
        to: inboxName,
        type: 'idle_notification',
        payload: { worker_id: 'w2' }
      });

      await mailbox.sendMessage(project, team, {
        from: 'w3',
        to: inboxName,
        type: 'idle_notification',
        payload: { worker_id: 'w3' }
      });

      // Mark first idle_notification as read
      const allMessages = mailbox.readMessages(project, team, inboxName);
      const firstIdle = allMessages.find(m => m.type === 'idle_notification');
      await mailbox.markAsRead(project, team, inboxName, firstIdle.id);

      // Run script with both filters
      const result = await runScript(
        scriptPath,
        [
          '--project', project,
          '--team', team,
          '--inbox', inboxName,
          '--unread-only',
          '--type', 'idle_notification'
        ],
        { TEAMWORK_TEST_BASE_DIR: testDir }
      );

      expect(result.code).toBe(0);

      const output = JSON.parse(result.stdout);
      expect(output.messages.length).toBe(1);
      expect(output.messages[0].type).toBe('idle_notification');
      expect(output.messages[0].read).toBe(false);
      expect(output.messages[0].payload.worker_id).toBe('w3');
    });
  });
});
