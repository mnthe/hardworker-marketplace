#!/usr/bin/env bun

/**
 * Shared hook utilities for teamwork plugin hooks.
 *
 * Provides common stdin parsing and guard check patterns used across
 * all teamwork hook handlers (project-progress, teammate-idle, orchestrator-completed).
 */

/**
 * Read all data from stdin as a string.
 * Uses process.stdin async iterator for portability across runtimes.
 * @returns {Promise<string>}
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return chunks.join('');
}

/**
 * Read hook input from stdin and parse as JSON.
 * Returns parsed object on success, empty object on empty input, null on parse error.
 * @returns {Promise<Object|null>}
 */
async function parseHookInput() {
  try {
    const raw = await readStdin();
    if (raw && raw.trim()) {
      return JSON.parse(raw);
    }
    return {};
  } catch {
    return null;
  }
}

/**
 * Check standard hook guards. Returns false if hook should exit early.
 * Checks: input validity (non-null), stop_hook_active flag.
 * @param {Object|null} hookInput - Parsed hook input from parseHookInput()
 * @returns {boolean} true if guards pass
 */
function passesGuards(hookInput) {
  if (!hookInput) return false;
  if (hookInput.stop_hook_active) return false;
  return true;
}

module.exports = { parseHookInput, passesGuards };
