#!/usr/bin/env bun

/**
 * Hook Utilities
 *
 * Shared utilities for hook scripts.
 */

/**
 * Reads JSON input from stdin.
 *
 * @returns {Promise<string>} The concatenated stdin content
 *
 * @example
 * ```javascript
 * const { readStdin } = require('./lib/hook-utils.js');
 *
 * async function main() {
 *   const input = await readStdin();
 *   const hookInput = JSON.parse(input);
 *   // Process hookInput...
 * }
 * ```
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return chunks.join('');
}

module.exports = {
  readStdin
};
