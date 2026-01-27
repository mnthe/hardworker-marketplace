#!/usr/bin/env bun
/**
 * Mailbox library for message-based communication
 * Provides inbox creation, message sending, reading, and marking as read
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { withLock } = require('./file-lock.js');

// Import path utilities
const { getProjectDir } = require('./project-utils.js');

/**
 * @typedef {Object} Message
 * @property {string} id - UUID v4
 * @property {string} from - Sender
 * @property {string} to - Recipient
 * @property {'text'|'idle_notification'|'shutdown_request'|'shutdown_response'} type - Message type
 * @property {unknown} payload - Type-specific data
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {boolean} read - Read status
 */

/**
 * @typedef {Object} Inbox
 * @property {Message[]} messages - Array of messages
 */

/**
 * Get inboxes directory path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {string} Inboxes directory path
 */
function getInboxesDir(project, team) {
  return path.join(getProjectDir(project, team), 'inboxes');
}

/**
 * Get inbox file path
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} inboxName - Inbox name (e.g., 'orchestrator', 'w1')
 * @returns {string} Inbox file path
 */
function getInboxFile(project, team, inboxName) {
  return path.join(getInboxesDir(project, team), `${inboxName}.json`);
}

/**
 * Generate UUID v4
 * @returns {string} UUID v4 string
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Read inbox data
 * @param {string} inboxFile - Inbox file path
 * @returns {Inbox} Inbox data
 */
function readInbox(inboxFile) {
  if (!fs.existsSync(inboxFile)) {
    return { messages: [] };
  }

  const content = fs.readFileSync(inboxFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write inbox data atomically
 * @param {string} inboxFile - Inbox file path
 * @param {Inbox} inbox - Inbox data
 */
function writeInbox(inboxFile, inbox) {
  // Ensure directory exists
  const dir = path.dirname(inboxFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpFile = `${inboxFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(inbox, null, 2), 'utf-8');
  fs.renameSync(tmpFile, inboxFile);
}

/**
 * Create inbox file with empty messages array
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} inboxName - Inbox name (e.g., 'orchestrator', 'w1')
 */
function createInbox(project, team, inboxName) {
  const inboxesDir = getInboxesDir(project, team);
  const inboxFile = getInboxFile(project, team, inboxName);

  // Create inboxes directory if it doesn't exist
  if (!fs.existsSync(inboxesDir)) {
    fs.mkdirSync(inboxesDir, { recursive: true });
  }

  // Don't overwrite existing inbox
  if (fs.existsSync(inboxFile)) {
    return;
  }

  // Create empty inbox
  const inbox = { messages: [] };
  writeInbox(inboxFile, inbox);
}

/**
 * Send message to inbox
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {Object} message - Message data
 * @param {string} message.from - Sender
 * @param {string} message.to - Recipient (inbox name)
 * @param {'text'|'idle_notification'|'shutdown_request'|'shutdown_response'} message.type - Message type
 * @param {unknown} message.payload - Type-specific data
 */
async function sendMessage(project, team, message) {
  const inboxFile = getInboxFile(project, team, message.to);

  // Ensure inbox exists
  createInbox(project, team, message.to);

  // Use file lock to prevent concurrent writes
  await withLock(inboxFile, async () => {
    const inbox = readInbox(inboxFile);

    // Create message with metadata
    const fullMessage = {
      id: generateUUID(),
      from: message.from,
      to: message.to,
      type: message.type,
      payload: message.payload,
      timestamp: new Date().toISOString(),
      read: false
    };

    inbox.messages.push(fullMessage);
    writeInbox(inboxFile, inbox);
  });
}

/**
 * Read messages from inbox
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} inboxName - Inbox name
 * @param {Object} [options] - Read options
 * @param {boolean} [options.unreadOnly] - Only return unread messages
 * @param {string} [options.type] - Filter by message type
 * @returns {Message[]} Array of messages
 */
function readMessages(project, team, inboxName, options = {}) {
  const inboxFile = getInboxFile(project, team, inboxName);

  if (!fs.existsSync(inboxFile)) {
    return [];
  }

  const inbox = readInbox(inboxFile);
  let messages = inbox.messages;

  // Filter by unread
  if (options.unreadOnly) {
    messages = messages.filter(msg => !msg.read);
  }

  // Filter by type
  if (options.type) {
    messages = messages.filter(msg => msg.type === options.type);
  }

  return messages;
}

/**
 * Mark message as read
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @param {string} inboxName - Inbox name
 * @param {string} messageId - Message ID to mark as read
 */
async function markAsRead(project, team, inboxName, messageId) {
  const inboxFile = getInboxFile(project, team, inboxName);

  if (!fs.existsSync(inboxFile)) {
    return;
  }

  // Use file lock to prevent concurrent modifications
  await withLock(inboxFile, async () => {
    const inbox = readInbox(inboxFile);

    // Find and mark message as read
    const message = inbox.messages.find(msg => msg.id === messageId);
    if (message) {
      message.read = true;
      writeInbox(inboxFile, inbox);
    }
  });
}

module.exports = {
  createInbox,
  sendMessage,
  readMessages,
  markAsRead,
  // Export for testing
  getInboxesDir,
  getInboxFile
};
