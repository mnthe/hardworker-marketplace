#!/usr/bin/env node

/**
 * Gate Enforcement Hook (PreToolUse)
 * Blocks Edit/Write during PLANNING phase (except design.md, session files)
 * v1.0: JavaScript version with JSDoc types
 */

const { isSessionActive, readSession } = require('../lib/session-utils.js');

/**
 * @typedef {import('../lib/types.js').Session} Session
 */

/**
 * @typedef {Object} ToolInput
 * @property {string} [file_path]
 */

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {string} [tool_name]
 * @property {ToolInput} [tool_input]
 */

/**
 * @typedef {Object} PreToolUseOutput
 * @property {Object} hookSpecificOutput
 * @property {string} hookSpecificOutput.hookEventName
 * @property {'allow' | 'deny'} hookSpecificOutput.permissionDecision
 * @property {string} [hookSpecificOutput.permissionDecisionReason]
 */

/**
 * Read all stdin data
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
 * Check if file is allowed during PLANNING phase
 * @param {string} filePath
 * @returns {boolean}
 */
function isFileAllowed(filePath) {
  if (!filePath) {
    return false;
  }

  // Allowed patterns during PLANNING:
  // - design.md (planning document)
  // - session.json, context.json (session state)
  // - exploration/*.md (explorer output)
  // - Any file in /.claude/ultrawork/ (session directory)

  if (filePath.includes('design.md')) {
    return true;
  }

  if (filePath.includes('session.json')) {
    return true;
  }

  if (filePath.includes('context.json')) {
    return true;
  }

  if (filePath.includes('/exploration/')) {
    return true;
  }

  if (filePath.includes('/.claude/ultrawork/')) {
    return true;
  }

  return false;
}

/**
 * Create denial response with detailed reason
 * @param {string} tool
 * @param {string} filePath
 * @param {string} sessionId
 * @param {string} sessionFile
 * @returns {PreToolUseOutput}
 */
function createDenialResponse(tool, filePath, sessionId, sessionFile) {
  const reason = `⛔ GATE VIOLATION: ${tool} blocked in PLANNING phase.

Current Phase: PLANNING
Blocked Tool: ${tool}
Target File: ${filePath}

Session ID: ${sessionId}
Session File: ${sessionFile}

Direct file modifications are prohibited during PLANNING phase.

To proceed, either:
1. Complete planning → transition to EXECUTION phase
2. Cancel session: /ultrawork-cancel

If this is unexpected (orphaned session), cancel with:
  /ultrawork-cancel

Allowed files during PLANNING:
- design.md, session.json, context.json, exploration/*.md`;

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  };
}

/**
 * Create allow response
 * @returns {PreToolUseOutput}
 */
function createAllowResponse() {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow'
    }
  };
}

/**
 * Main hook logic
 * @returns {Promise<void>}
 */
async function main() {
  // Import here to get path utilities
  const { getSessionFile } = require('../lib/session-utils.js');

  try {
    // Read stdin JSON
    const input = await readStdin();
    /** @type {HookInput} */
    const hookInput = JSON.parse(input);

    // Extract tool name
    const toolName = hookInput.tool_name || '';

    // Only process Edit and Write tools
    if (toolName !== 'Edit' && toolName !== 'Write') {
      console.log(JSON.stringify(createAllowResponse()));
      process.exit(0);
      return;
    }

    // Extract session ID
    const sessionId = hookInput.session_id;

    // No session - allow
    if (!sessionId) {
      console.log(JSON.stringify(createAllowResponse()));
      process.exit(0);
      return;
    }

    // Check if session is active
    if (!isSessionActive(sessionId)) {
      console.log(JSON.stringify(createAllowResponse()));
      process.exit(0);
      return;
    }

    // Get session file path for error message
    const sessionFile = getSessionFile(sessionId);

    // Get session data
    /** @type {Session} */
    let session;
    try {
      session = readSession(sessionId);
    } catch {
      // Session file error - allow
      console.log(JSON.stringify(createAllowResponse()));
      process.exit(0);
      return;
    }

    // Only enforce during PLANNING phase
    if (session.phase !== 'PLANNING') {
      console.log(JSON.stringify(createAllowResponse()));
      process.exit(0);
      return;
    }

    // Get file path from tool input
    const filePath = hookInput.tool_input?.file_path || '';

    // Check if file is allowed
    if (isFileAllowed(filePath)) {
      console.log(JSON.stringify(createAllowResponse()));
      process.exit(0);
      return;
    }

    // Block with clear message including session details
    console.log(JSON.stringify(createDenialResponse(toolName, filePath, sessionId, sessionFile)));
    process.exit(0);
  } catch (err) {
    // On error, allow (fail open for safety)
    console.log(JSON.stringify(createAllowResponse()));
    process.exit(0);
  }
}

// Handle stdin
if (process.stdin.isTTY) {
  // No stdin available, allow by default
  console.log(JSON.stringify(createAllowResponse()));
  process.exit(0);
} else {
  // Read stdin and process
  process.stdin.setEncoding('utf8');
  main().catch(() => {
    // On error, allow (fail open)
    console.log(JSON.stringify(createAllowResponse()));
    process.exit(0);
  });
}
