#!/usr/bin/env bun
/**
 * mailbox-send.js - Send message to inbox
 * CLI to send messages for teamwork worker coordination
 *
 * Usage: mailbox-send.js --project <name> --team <name> --from <sender> --to <recipient> --type <type> --payload <data>
 */

const { parseArgs, generateHelp } = require('../lib/args.js');
const { sendMessage } = require('../lib/mailbox.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-T'], required: true },
  '--from': { key: 'from', aliases: ['-f'], required: true },
  '--to': { key: 'to', aliases: ['-t'], required: true },
  '--type': { key: 'type', required: true },
  '--payload': { key: 'payload', required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// Valid message types
const VALID_TYPES = ['text', 'idle_notification', 'shutdown_request', 'shutdown_response'];

// ============================================================================
// Message Sending
// ============================================================================

/**
 * Send message to inbox
 * @param {Object} args - CLI arguments
 * @returns {Promise<void>}
 */
async function sendMessageToInbox(args) {
  // Validate message type
  if (!VALID_TYPES.includes(args.type)) {
    console.error(`Error: Invalid type "${args.type}". Must be: ${VALID_TYPES.join(', ')}`);
    process.exit(1);
  }

  // Parse payload: try JSON first, fall back to string
  let payload = args.payload;
  try {
    payload = JSON.parse(args.payload);
  } catch {
    // If not valid JSON, keep as string
  }

  // Send message using mailbox library
  await sendMessage(args.project, args.team, {
    from: args.from,
    to: args.to,
    type: args.type,
    payload: payload
  });

  console.log('OK: Message sent');
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    // Check for help flag first
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(generateHelp('mailbox-send.js', ARG_SPEC, 'Send a message to an inbox for worker coordination'));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);
    await sendMessageToInbox(args);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Unknown error occurred');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
