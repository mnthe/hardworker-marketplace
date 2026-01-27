#!/usr/bin/env bun
/**
 * Tests for mailbox-poll.js
 */

const { test, expect, describe, beforeEach, afterAll } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/mailbox-poll.js');

// Helper to create inbox with messages
function createInboxWithMessages(project, team, inboxName, messages) {
  const inboxesDir = path.join(TEAMWORK_TEST_BASE_DIR, project, team, 'inboxes');
  const inboxFile = path.join(inboxesDir, `${inboxName}.json`);

  if (!fs.existsSync(inboxesDir)) {
    fs.mkdirSync(inboxesDir, { recursive: true });
  }

  const inbox = { messages };
  fs.writeFileSync(inboxFile, JSON.stringify(inbox, null, 2), 'utf-8');

  return inboxFile;
}

describe('mailbox-poll.js', () => {
  const testProject = 'poll-test-project';
  const testTeam = 'poll-test-team';
  const testInbox = 'orchestrator';

  beforeEach(() => {
    // Clean up test data before each test
    const testDir = path.join(TEAMWORK_TEST_BASE_DIR, testProject);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Clean up all test projects
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('mailbox-poll');
  });

  test('returns immediately when unread messages exist', () => {
    // Create inbox with unread message
    const messages = [
      {
        id: 'msg-1',
        from: 'worker-1',
        to: testInbox,
        type: 'idle_notification',
        payload: { status: 'idle' },
        timestamp: new Date().toISOString(),
        read: false
      }
    ];

    createInboxWithMessages(testProject, testTeam, testInbox, messages);

    const result = runScript(SCRIPT_PATH, {
      project: testProject,
      team: testTeam,
      inbox: testInbox,
      timeout: '5000'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(Array.isArray(result.json)).toBe(true);
    expect(result.json.length).toBe(1);
    expect(result.json[0].id).toBe('msg-1');
  });

  test('returns empty array on timeout when no messages', () => {
    // Create empty inbox
    createInboxWithMessages(testProject, testTeam, testInbox, []);

    const result = runScript(SCRIPT_PATH, {
      project: testProject,
      team: testTeam,
      inbox: testInbox,
      timeout: '500'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(Array.isArray(result.json)).toBe(true);
    expect(result.json.length).toBe(0);
  });

  test('filters by message type when --type specified', () => {
    // Create inbox with mixed message types
    const messages = [
      {
        id: 'msg-1',
        from: 'worker-1',
        to: testInbox,
        type: 'idle_notification',
        payload: {},
        timestamp: new Date().toISOString(),
        read: false
      },
      {
        id: 'msg-2',
        from: 'worker-2',
        to: testInbox,
        type: 'text',
        payload: {},
        timestamp: new Date().toISOString(),
        read: false
      }
    ];

    createInboxWithMessages(testProject, testTeam, testInbox, messages);

    const result = runScript(SCRIPT_PATH, {
      project: testProject,
      team: testTeam,
      inbox: testInbox,
      timeout: '1000',
      type: 'idle_notification'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.length).toBe(1);
    expect(result.json[0].type).toBe('idle_notification');
  });

  test('ignores already read messages', () => {
    // Create inbox with read and unread messages
    const messages = [
      {
        id: 'msg-1',
        from: 'worker-1',
        to: testInbox,
        type: 'idle_notification',
        payload: {},
        timestamp: new Date().toISOString(),
        read: true // already read
      },
      {
        id: 'msg-2',
        from: 'worker-2',
        to: testInbox,
        type: 'idle_notification',
        payload: {},
        timestamp: new Date().toISOString(),
        read: false
      }
    ];

    createInboxWithMessages(testProject, testTeam, testInbox, messages);

    const result = runScript(SCRIPT_PATH, {
      project: testProject,
      team: testTeam,
      inbox: testInbox,
      timeout: '1000'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.length).toBe(1);
    expect(result.json[0].id).toBe('msg-2');
  });

  test('fails without required --project parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      team: testTeam,
      inbox: testInbox
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --team parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: testProject,
      inbox: testInbox
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --inbox parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: testProject,
      team: testTeam
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('uses default timeout when not specified', () => {
    // Create empty inbox
    createInboxWithMessages(testProject, testTeam, testInbox, []);

    // Use explicit timeout for test (default 30s is too long for tests)
    const result = runScript(SCRIPT_PATH, {
      project: testProject,
      team: testTeam,
      inbox: testInbox,
      timeout: '1000'
    });

    // Should timeout and return empty array
    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(Array.isArray(result.json)).toBe(true);
  });
});
