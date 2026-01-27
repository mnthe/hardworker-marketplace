#!/usr/bin/env bun
/**
 * mailbox-read.js - Read messages from inbox
 * CLI to read and optionally filter messages from a teamwork inbox
 *
 * Usage: mailbox-read.js --project <name> --team <name> --inbox <name> [--unread-only] [--type <type>] [--mark-read]
 */

const { parseArgs, generateHelp } = require('../lib/args.js');
const { readMessages, markAsRead } = require('../lib/mailbox.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--inbox': { key: 'inbox', aliases: ['-i'], required: true },
  '--unread-only': { key: 'unreadOnly', aliases: ['-u'], flag: true },
  '--type': { key: 'type' },
  '--mark-read': { key: 'markRead', aliases: ['-m'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
async function main() {
  try {
    // Check for help flag first
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(
        generateHelp(
          'mailbox-read.js',
          ARG_SPEC,
          'Read messages from a teamwork inbox with optional filtering and mark-as-read functionality.'
        )
      );
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

    // Build options for readMessages
    const options = {};
    if (args.unreadOnly) {
      options.unreadOnly = true;
    }
    if (args.type) {
      options.type = args.type;
    }

    // Read messages
    const messages = readMessages(args.project, args.team, args.inbox, options);

    // Mark messages as read if requested
    if (args.markRead && messages.length > 0) {
      for (const message of messages) {
        await markAsRead(args.project, args.team, args.inbox, message.id);
      }
    }

    // Output JSON
    console.log(JSON.stringify({ messages }, null, 2));
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
