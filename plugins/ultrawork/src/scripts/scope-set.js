#!/usr/bin/env bun
/**
 * scope-set.js - Set scope expansion analysis in context.json
 * Usage: scope-set.js --session <ID> --data '<JSON>'
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir } = require('../lib/session-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

const ARG_SPEC = {
  '--session': { key: 'sessionId', alias: '-s', required: true },
  '--data': { key: 'data', alias: '-d', required: true },
  '--help': { key: 'help', alias: '-h', flag: true }
};

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('scope-set.js', ARG_SPEC, 'Set scope expansion data in context.json'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);
  const { sessionId, data } = args;

  try {
    const sessionDir = getSessionDir(sessionId);
    const contextFile = path.join(sessionDir, 'context.json');

    if (!fs.existsSync(contextFile)) {
      console.error('Error: context.json does not exist. Run context-init.js first.');
      process.exit(1);
    }

    const content = fs.readFileSync(contextFile, 'utf-8');
    const context = JSON.parse(content);

    // Parse and validate scope expansion data
    const scopeExpansion = JSON.parse(data);

    // Basic validation
    if (!scopeExpansion.originalRequest) {
      console.error('Error: scopeExpansion.originalRequest is required');
      process.exit(1);
    }

    context.scopeExpansion = scopeExpansion;
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');

    console.log('OK: Scope expansion set in context.json');
    console.log(`    Layers: ${(scopeExpansion.detectedLayers || []).join(', ')}`);
    console.log(`    Dependencies: ${(scopeExpansion.dependencies || []).length}`);
    console.log(`    Suggested tasks: ${(scopeExpansion.suggestedTasks || []).length}`);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
