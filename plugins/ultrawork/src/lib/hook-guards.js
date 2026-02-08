/**
 * Hook Guards - Common guard patterns for ultrawork lifecycle hooks
 * Extracts repeated boilerplate: stdin parsing, session validation, session reading
 */

const { readStdin } = require('./hook-utils.js');
const { getSessionFile } = require('./session-utils.js');
const { readJsonSafe } = require('./json-ops.js');

// ============================================================================
// Hook Input Parsing
// ============================================================================

/**
 * Parse hook input from stdin. Returns parsed JSON or null on failure.
 * Replaces the common `readStdin()` + `JSON.parse()` pattern.
 * @returns {Promise<Object|null>}
 */
async function parseHookInput() {
  try {
    const raw = await readStdin();
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ============================================================================
// Session Guards
// ============================================================================

/**
 * Standard guard checks for hooks that require an active ultrawork session.
 * Returns session data if all guards pass, null otherwise.
 *
 * Guards (in order):
 * 1. hookInput existence check
 * 2. stop_hook_active check (prevents infinite hook loops)
 * 3. session_id presence check
 * 4. Session file existence check
 * 5. Session JSON parse check
 *
 * @param {Object|null} hookInput - Parsed hook input from parseHookInput()
 * @returns {{ session: Object, sessionId: string } | null}
 */
function guardSession(hookInput) {
  if (!hookInput) return null;
  if (hookInput.stop_hook_active) return null;

  const sessionId = hookInput.session_id;
  if (!sessionId) return null;

  const sessionFile = getSessionFile(sessionId);
  const session = readJsonSafe(sessionFile);
  if (!session) return null;

  return { session, sessionId };
}

module.exports = { parseHookInput, guardSession };
