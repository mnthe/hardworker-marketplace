#!/usr/bin/env bun

/**
 * Gate Enforcement Hook (PreToolUse)
 * Blocks Edit/Write during PLANNING phase (except design.md, session files)
 * Enforces TDD order: test files must be written before implementation
 * v2.0: Added TDD enforcement
 */

const fs = require('fs');
const path = require('path');
const { isSessionActive, readSession, getSessionDir } = require('../lib/session-utils.js');

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').Task} Task
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

  if (filePath.endsWith('design.md')) {
    return true;
  }

  if (filePath.endsWith('session.json')) {
    return true;
  }

  if (filePath.endsWith('context.json')) {
    return true;
  }

  if (filePath.includes('/exploration/')) {
    return true;
  }

  if (filePath.includes('/.claude/ultrawork/')) {
    return true;
  }

  // Plan documents in docs/plans/ (planner agent output)
  if (filePath.includes('/docs/plans/') || filePath.includes('docs/plans/')) {
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
- *-design.md, session.json, context.json, exploration/*.md, docs/plans/*.md`;

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

// ============================================================================
// TDD Enforcement
// ============================================================================

/**
 * Check if a file path looks like a test file
 * @param {string} filePath
 * @returns {boolean}
 */
function isTestFile(filePath) {
  if (!filePath) return false;

  // Common test file patterns
  return (
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    filePath.includes('__tests__/') ||
    filePath.includes('/tests/') ||
    filePath.includes('/test/') ||
    filePath.endsWith('_test.js') ||
    filePath.endsWith('_test.ts') ||
    filePath.endsWith('_test.py')
  );
}

/**
 * Get the current in-progress TDD task for the session
 * @param {string} sessionId
 * @returns {Task | null}
 */
function getCurrentTddTask(sessionId) {
  try {
    const sessionDir = getSessionDir(sessionId);
    const tasksDir = path.join(sessionDir, 'tasks');

    if (!fs.existsSync(tasksDir)) {
      return null;
    }

    const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));

    for (const taskFile of taskFiles) {
      const taskPath = path.join(tasksDir, taskFile);
      const taskContent = fs.readFileSync(taskPath, 'utf-8');
      /** @type {Task} */
      const task = JSON.parse(taskContent);

      // Check if this is an in-progress TDD task
      if (task.approach === 'tdd' && task.status === 'in_progress') {
        return task;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if TDD-RED evidence exists for a task
 * @param {Task} task
 * @returns {boolean}
 */
function hasTddRedEvidence(task) {
  if (!task.evidence || task.evidence.length === 0) {
    return false;
  }

  return task.evidence.some(e => {
    const desc = e.description || '';
    return desc.includes('TDD-RED');
  });
}

/**
 * Create TDD violation response
 * @param {string} tool
 * @param {string} filePath
 * @param {Task} task
 * @returns {PreToolUseOutput}
 */
function createTddViolationResponse(tool, filePath, task) {
  const reason = `⛔ TDD VIOLATION: Write test first!

Task "${task.subject}" uses TDD approach.
You must write and run a failing test BEFORE implementation.

Current file: ${filePath}
Task ID: ${task.id}
Task approach: tdd

TDD Workflow:
1. 🔴 RED: Write test file first → run test → verify it FAILS
2. 🟢 GREEN: Write implementation → run test → verify it PASSES
3. 🔄 REFACTOR: Improve code → verify tests still pass

Current state: Missing TDD-RED evidence (test not written/run yet)

To proceed:
1. Write your test file first (*.test.ts, *.spec.js, etc.)
2. Run the test and record the failure
3. Then implement the feature`;

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
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
    }

    // Extract session ID
    const sessionId = hookInput.session_id;

    // No session - allow
    if (!sessionId) {
      console.log(JSON.stringify(createAllowResponse()));
      process.exit(0);
    }

    // Check if session is active
    if (!isSessionActive(sessionId)) {
      console.log(JSON.stringify(createAllowResponse()));
      process.exit(0);
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
    }

    // Get file path from tool input
    const filePath = hookInput.tool_input?.file_path || '';

    // =========================================================================
    // Phase 1: PLANNING phase enforcement
    // =========================================================================
    if (session.phase === 'PLANNING') {
      // Check if file is allowed during PLANNING
      if (isFileAllowed(filePath)) {
        console.log(JSON.stringify(createAllowResponse()));
        process.exit(0);
      }

      // Block with clear message including session details
      console.log(JSON.stringify(createDenialResponse(toolName, filePath, sessionId, sessionFile)));
      process.exit(0);
    }

    // =========================================================================
    // Phase 2: TDD enforcement during EXECUTION phase
    // =========================================================================
    if (session.phase === 'EXECUTION') {
      // Check for current TDD task
      const tddTask = getCurrentTddTask(sessionId);

      if (tddTask) {
        // If writing to a non-test file, check TDD-RED evidence
        if (!isTestFile(filePath) && !isFileAllowed(filePath)) {
          // Check if TDD-RED evidence exists
          if (!hasTddRedEvidence(tddTask)) {
            // Block: trying to write implementation before test
            console.log(JSON.stringify(createTddViolationResponse(toolName, filePath, tddTask)));
            process.exit(0);
          }
        }
      }
    }

    // Allow all other cases
    console.log(JSON.stringify(createAllowResponse()));
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
