#!/usr/bin/env bun

/**
 * mailbox-poll.js
 * Poll inbox for new messages with timeout
 */

const { parseArgs, generateHelp } = require('../lib/args.js');
const { readMessages } = require('../lib/mailbox.js');

const argSpec = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--inbox': { key: 'inbox', aliases: ['-i'], required: true },
  '--timeout': { key: 'timeout', aliases: [], default: '30000' },
  '--type': { key: 'type', aliases: [] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// Check for help flag before parsing (to avoid required arg errors)
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  const help = generateHelp(
    'mailbox-poll.js',
    argSpec,
    'Poll inbox for new messages. Returns immediately on message arrival or after timeout.'
  );
  console.log(help);
  process.exit(0);
}

const args = parseArgs(argSpec);

const project = args.project;
const team = args.team;
const inbox = args.inbox;
const timeout = parseInt(args.timeout, 10);
const type = args.type;

// Poll configuration
const POLL_INTERVAL = 500; // Check every 500ms

/**
 * Poll inbox for messages
 */
async function pollInbox() {
  const startTime = Date.now();

  while (true) {
    // Read unread messages
    const options = { unreadOnly: true };
    if (type) {
      options.type = type;
    }

    const messages = readMessages(project, team, inbox, options);

    // Return immediately if messages found
    if (messages.length > 0) {
      console.log(JSON.stringify(messages));
      return;
    }

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= timeout) {
      // Timeout - return empty array
      console.log(JSON.stringify([]));
      return;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

// Run poll
pollInbox()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error polling inbox:', error.message);
    process.exit(1);
  });
