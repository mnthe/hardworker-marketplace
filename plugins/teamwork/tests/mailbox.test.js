#!/usr/bin/env bun
/**
 * Tests for mailbox library
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the library to test
const mailbox = require('../src/lib/mailbox.js');

describe('mailbox', () => {
  let testDir;
  let project;
  let team;

  beforeEach(() => {
    // Create isolated test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailbox-test-'));

    // Override base directory for tests
    process.env.TEAMWORK_TEST_BASE_DIR = testDir;

    project = 'test-project';
    team = 'test-team';

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

  describe('createInbox', () => {
    test('creates inbox file with empty messages array', () => {
      const inboxName = 'orchestrator';

      mailbox.createInbox(project, team, inboxName);

      const inboxFile = path.join(testDir, project, team, 'inboxes', `${inboxName}.json`);
      expect(fs.existsSync(inboxFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
      expect(content.messages).toEqual([]);
    });

    test('creates inboxes directory if it does not exist', () => {
      const inboxName = 'w1';

      mailbox.createInbox(project, team, inboxName);

      const inboxesDir = path.join(testDir, project, team, 'inboxes');
      expect(fs.existsSync(inboxesDir)).toBe(true);
    });

    test('does not overwrite existing inbox', async () => {
      const inboxName = 'orchestrator';

      // Create inbox with messages
      mailbox.createInbox(project, team, inboxName);
      await mailbox.sendMessage(project, team, {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Hello'
      });

      // Try to create again
      mailbox.createInbox(project, team, inboxName);

      // Read messages
      const messages = mailbox.readMessages(project, team, inboxName);
      expect(messages.length).toBe(1); // Message should still exist
    });
  });

  describe('sendMessage', () => {
    test('sends message to inbox', async () => {
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      const message = {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Task completed'
      };

      await mailbox.sendMessage(project, team, message);

      const messages = mailbox.readMessages(project, team, inboxName);
      expect(messages.length).toBe(1);
      expect(messages[0].from).toBe('w1');
      expect(messages[0].to).toBe(inboxName);
      expect(messages[0].type).toBe('text');
      expect(messages[0].payload).toBe('Task completed');
      expect(messages[0].read).toBe(false);
      expect(messages[0].id).toBeDefined();
      expect(messages[0].timestamp).toBeDefined();
    });

    test('sends idle_notification message', async () => {
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      const message = {
        from: 'w1',
        to: inboxName,
        type: 'idle_notification',
        payload: {
          worker_id: 'w1',
          completed_task_id: '3',
          completed_status: 'resolved'
        }
      };

      await mailbox.sendMessage(project, team, message);

      const messages = mailbox.readMessages(project, team, inboxName);
      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe('idle_notification');
      expect(messages[0].payload.worker_id).toBe('w1');
      expect(messages[0].payload.completed_task_id).toBe('3');
    });

    test('creates inbox if it does not exist', async () => {
      const inboxName = 'w1';

      const message = {
        from: 'orchestrator',
        to: inboxName,
        type: 'text',
        payload: 'New task assigned'
      };

      await mailbox.sendMessage(project, team, message);

      const messages = mailbox.readMessages(project, team, inboxName);
      expect(messages.length).toBe(1);
    });

    test('generates unique message IDs', async () => {
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

      const messages = mailbox.readMessages(project, team, inboxName);
      expect(messages[0].id).not.toBe(messages[1].id);
    });
  });

  describe('readMessages', () => {
    test('reads all messages from inbox', async () => {
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

      const messages = mailbox.readMessages(project, team, inboxName);
      expect(messages.length).toBe(2);
    });

    test('filters unread messages', async () => {
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      await mailbox.sendMessage(project, team, {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Message 1'
      });

      const messages1 = mailbox.readMessages(project, team, inboxName);
      const messageId = messages1[0].id;

      // Mark first message as read
      await mailbox.markAsRead(project, team, inboxName, messageId);

      await mailbox.sendMessage(project, team, {
        from: 'w2',
        to: inboxName,
        type: 'text',
        payload: 'Message 2'
      });

      // Filter unread only
      const unreadMessages = mailbox.readMessages(project, team, inboxName, { unreadOnly: true });
      expect(unreadMessages.length).toBe(1);
      expect(unreadMessages[0].payload).toBe('Message 2');
    });

    test('filters by message type', async () => {
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

      const idleMessages = mailbox.readMessages(project, team, inboxName, { type: 'idle_notification' });
      expect(idleMessages.length).toBe(1);
      expect(idleMessages[0].type).toBe('idle_notification');
    });

    test('returns empty array for nonexistent inbox', () => {
      const messages = mailbox.readMessages(project, team, 'nonexistent');
      expect(messages).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    test('marks message as read', async () => {
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      await mailbox.sendMessage(project, team, {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Test message'
      });

      const messages = mailbox.readMessages(project, team, inboxName);
      const messageId = messages[0].id;

      expect(messages[0].read).toBe(false);

      await mailbox.markAsRead(project, team, inboxName, messageId);

      const updatedMessages = mailbox.readMessages(project, team, inboxName);
      expect(updatedMessages[0].read).toBe(true);
    });

    test('does nothing for nonexistent message', async () => {
      const inboxName = 'orchestrator';
      mailbox.createInbox(project, team, inboxName);

      await mailbox.sendMessage(project, team, {
        from: 'w1',
        to: inboxName,
        type: 'text',
        payload: 'Test message'
      });

      // Try to mark nonexistent message as read
      await mailbox.markAsRead(project, team, inboxName, 'nonexistent-id');

      // Message should remain unread
      const messages = mailbox.readMessages(project, team, inboxName);
      expect(messages[0].read).toBe(false);
    });
  });
});
