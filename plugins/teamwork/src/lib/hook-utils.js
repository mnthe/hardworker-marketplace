#!/usr/bin/env bun

/**
 * Hook utility functions for teamwork plugin hooks.
 * Provides standardized stdin reading, error handling, and output formatting.
 *
 * @example
 * import { readStdin, outputAndExit, safeJsonParse } from '../lib/hook-utils.js';
 *
 * async function main() {
 *   const input = await readStdin();
 *   const data = safeJsonParse(input);
 *   outputAndExit({ decision: 'approve' });
 * }
 */

/**
 * Read all data from stdin.
 * Used by hooks to receive hook input from Claude Code.
 *
 * @returns {Promise<string>} All stdin data as a string
 *
 * @example
 * const input = await readStdin();
 * const hookInput = JSON.parse(input);
 */
export async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

/**
 * Output hook response and exit.
 * Writes JSON to stdout and exits with code 0.
 *
 * @param {Object} output - Hook output object
 * @returns {void}
 *
 * @example
 * // Stop hook - block/approve with reason
 * outputAndExit({
 *   decision: 'block',
 *   reason: '/command to run',
 *   systemMessage: 'Continuing work...'
 * });
 *
 * @example
 * // Generic hook - custom fields
 * outputAndExit({
 *   status: 'success',
 *   data: { key: 'value' }
 * });
 */
export function outputAndExit(output) {
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Safely parse JSON with fallback.
 * Returns parsed object on success, fallback value on error.
 *
 * @param {string} input - JSON string to parse
 * @param {*} [fallback={}] - Value to return on parse error
 * @returns {*} Parsed object or fallback value
 *
 * @example
 * const data = safeJsonParse(input, { default: 'value' });
 */
export function safeJsonParse(input, fallback = {}) {
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

/**
 * Handle hook errors safely.
 * Outputs minimal valid JSON and exits with code 0.
 * Hooks should never fail the tool execution.
 *
 * @param {Error} [error] - Optional error to log to stderr
 * @returns {void}
 *
 * @example
 * try {
 *   await processHook();
 * } catch (err) {
 *   handleHookError(err);
 * }
 */
export function handleHookError(error) {
  if (error && process.env.DEBUG) {
    console.error('[hook error]', error.message);
  }
  outputAndExit({});
}

/**
 * Check if stdin is available (not TTY).
 * Used to detect if hook is being called correctly.
 *
 * @returns {boolean} True if stdin is available
 *
 * @example
 * if (!hasStdin()) {
 *   outputAndExit({});
 * }
 */
export function hasStdin() {
  return !process.stdin.isTTY;
}

/**
 * Extract text content from hook input.
 * Tries multiple common fields: transcript, output, raw input.
 *
 * @param {Object} hookInput - Parsed hook input object
 * @param {string} rawInput - Raw input string as fallback
 * @returns {string} Extracted text content
 *
 * @example
 * const hookInput = JSON.parse(await readStdin());
 * const text = extractTextContent(hookInput, rawInputString);
 */
export function extractTextContent(hookInput, rawInput) {
  return hookInput.transcript || hookInput.output || rawInput;
}
