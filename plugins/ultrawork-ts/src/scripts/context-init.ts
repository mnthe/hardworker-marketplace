#!/usr/bin/env node
/**
 * context-init.ts - Initialize context.json with expected explorers
 * Usage: context-init.ts --session <ID> --expected "overview,exp-1,exp-2,exp-3"
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSessionDir } from '../lib/session-utils';

// ============================================================================
// Types
// ============================================================================

interface ContextFile {
  version: string;
  expected_explorers: string[];
  exploration_complete: boolean;
  explorers: Array<{
    id: string;
    hint: string;
    file: string;
    summary: string;
  }>;
  key_files: string[];
  patterns: string[];
  constraints: string[];
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(): { sessionId: string; expected: string } {
  const args = process.argv.slice(2);
  let sessionId = '';
  let expected = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--session':
        sessionId = args[++i] || '';
        break;
      case '--expected':
        expected = args[++i] || '';
        break;
      case '-h':
      case '--help':
        console.log('Usage: context-init.ts --session <ID> --expected "overview,exp-1,exp-2"');
        console.log('');
        console.log('Initializes context.json with expected explorer IDs.');
        console.log('exploration_complete will be set to true when all expected explorers are added.');
        process.exit(0);
    }
  }

  if (!sessionId || !expected) {
    console.error('Error: --session and --expected required');
    process.exit(1);
  }

  return { sessionId, expected };
}

// ============================================================================
// Main Logic
// ============================================================================

function main(): void {
  const { sessionId, expected } = parseArgs();

  try {
    // Get session directory
    const sessionDir = getSessionDir(sessionId);
    const contextFile = path.join(sessionDir, 'context.json');

    // Parse expected explorers from comma-separated string
    const expectedExplorers = expected
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    // Check if context.json exists
    if (fs.existsSync(contextFile)) {
      // Update existing context.json
      const content = fs.readFileSync(contextFile, 'utf-8');
      const context = JSON.parse(content) as ContextFile;

      context.expected_explorers = expectedExplorers;
      context.exploration_complete = false;

      fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
    } else {
      // Create new context.json
      const newContext: ContextFile = {
        version: '2.1',
        expected_explorers: expectedExplorers,
        exploration_complete: false,
        explorers: [],
        key_files: [],
        patterns: [],
        constraints: [],
      };

      fs.writeFileSync(contextFile, JSON.stringify(newContext, null, 2), 'utf-8');
    }

    console.log('OK: context.json initialized');
    console.log(`    Expected explorers: ${expected}`);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
  main();
}
