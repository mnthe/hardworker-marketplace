#!/usr/bin/env bun

/**
 * Shared hook utilities for teamwork plugin hooks.
 *
 * Provides common stdin parsing and guard check patterns used across
 * all teamwork hook handlers (project-progress, teammate-idle, orchestrator-completed).
 */

/**
 * Read hook input from stdin and parse as JSON.
 * Uses Bun.stdin.text() for consistency with existing hook patterns.
 * Returns parsed object on success, empty object on empty input, null on parse error.
 * @returns {Promise<Object|null>}
 */
async function parseHookInput() {
  try {
    const raw = await Bun.stdin.text();
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
