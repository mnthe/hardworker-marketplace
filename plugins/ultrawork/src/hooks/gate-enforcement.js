#!/usr/bin/env bun

/**
 * Gate Enforcement Hook (PreToolUse)
 * Blocks Edit/Write during PLANNING phase (except design.md, session files)
 * Enforces TDD order: test files must be written before implementation
 * v2.0: Added TDD enforcement
 * v2.1: Added additionalContext support (Claude Code v2.1.9+)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { isSessionActive, readSessionField, getSessionDir } = require('../lib/session-utils.js');

/**
 * Check if codex CLI is available on the system
 * @returns {boolean}
 */
function isCodexInstalled() {
  try {
    execSync('which codex', { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the Codex result file path for a session
 * @param {string} sessionId
 * @returns {string}
 */
function getCodexResultPath(sessionId) {
  return `/tmp/codex-${sessionId}.json`;
}

/**
 * Get the Codex doc-review result file path for a session
 * @param {string} sessionId
 * @returns {string}
 */
function getCodexDocResultPath(sessionId) {
  return `/tmp/codex-doc-${sessionId}.json`;
}

const {
  createPreToolUseAllow,
  createPreToolUseBlock,
  runHook
} = require('../lib/hook-utils.js');
const { parseHookInput } = require('../lib/hook-guards.js');

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
 * @returns {Object}
 */
function createDenialResponse(tool, filePath, sessionId, sessionFile) {
  const reason = `${tool} blocked during PLANNING phase`;

  const additionalContext = `⛔ GATE VIOLATION: File modifications blocked in PLANNING phase

Current Phase: PLANNING
Blocked Tool: ${tool}
Target File: ${filePath}

Session ID: ${sessionId}
Session File: ${sessionFile}

WHY BLOCKED:
Direct file modifications are prohibited during PLANNING phase. This ensures you complete codebase exploration and task decomposition before making changes.

WHAT TO DO:
1. Complete planning → transition to EXECUTION phase
2. Or cancel session: /ultrawork-clean

If this is unexpected (orphaned session), cancel with:
  /ultrawork-clean

ALLOWED FILES DURING PLANNING:
- *-design.md, session.json, context.json, exploration/*.md, docs/plans/*.md`;

  return createPreToolUseBlock(reason, additionalContext);
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
    if (typeof e === 'string') {
      return e.includes('TDD-RED');
    }
    // Structured evidence object (legacy/future format)
    const desc = e.description || '';
    return desc.includes('TDD-RED');
  });
}

/**
 * Create TDD violation response
 * @param {string} tool
 * @param {string} filePath
 * @param {Task} task
 * @returns {Object}
 */
function createTddViolationResponse(tool, filePath, task) {
  const reason = `${tool} blocked: TDD requires test-first approach`;

  const additionalContext = `⛔ TDD VIOLATION: Write test first!

Task: "${task.subject}" (ID: ${task.id})
Task approach: tdd
Current file: ${filePath}

WHY BLOCKED:
This task uses Test-Driven Development (TDD) approach. You must write and run a failing test BEFORE writing implementation code. This ensures your tests actually verify the behavior you're implementing.

CURRENT STATE:
Missing TDD-RED evidence (test not written/run yet)

TDD WORKFLOW:
1. 🔴 RED: Write test file first → run test → verify it FAILS
2. 🟢 GREEN: Write implementation → run test → verify it PASSES
3. 🔄 REFACTOR: Improve code → verify tests still pass

WHAT TO DO:
1. Write your test file first (*.test.ts, *.spec.js, etc.)
2. Run the test and record the failure (TDD-RED evidence)
3. Then implement the feature in ${filePath}

TEST FILE PATTERNS:
- *.test.ts, *.test.js
- *.spec.ts, *.spec.js
- __tests__/*.ts, __tests__/*.js`;

  return createPreToolUseBlock(reason, additionalContext);
}

// ============================================================================
// Codex Doc-Review Gate
// ============================================================================

/**
 * Check if PLANNING->EXECUTION transition should be blocked by doc-review gate.
 * Returns a block response object if gate fires, or null if gate does not apply (allow).
 * @param {string} sessionId
 * @param {string} command - The bash command being executed
 * @returns {Object|null} Block response or null (allow)
 */
function checkCodexDocGate(sessionId, command) {
  // Only applies to session-update commands targeting EXECUTION phase
  if (!command.includes('session-update')) return null;
  if (!/--phase\s+EXECUTION|-p\s+EXECUTION/i.test(command)) return null;

  // Only applies when current phase is PLANNING
  let currentPhase;
  try {
    currentPhase = readSessionField(sessionId, 'phase');
  } catch {
    return null; // Session not found - allow
  }
  if (currentPhase !== 'PLANNING') return null;

  const resultPath = getCodexDocResultPath(sessionId);

  if (!fs.existsSync(resultPath)) {
    // If Codex is not installed, allow through (graceful degradation)
    if (!isCodexInstalled()) {
      return null;
    }
    return createPreToolUseBlock(
      'Codex doc-review not completed',
      `⛔ CODEX DOC-REVIEW GATE: doc-review result not found

Expected file: ${resultPath}

Codex CLI is installed but doc-review has not been run.
The Codex doc-review must complete before transitioning from PLANNING to EXECUTION.

WHAT TO DO:
1. Run codex doc-review on the design document
2. Wait for the result file to be created
3. Retry this command`
    );
  }

  try {
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));

    if (result.verdict === 'FAIL') {
      const issues = [];
      // Check both top-level doc_issues and nested doc_review.doc_issues
      const docIssues = result.doc_issues || result.doc_review?.doc_issues || [];
      for (const issue of docIssues) {
        if (issue.severity === 'error') {
          issues.push(`[${issue.category}] ${issue.detail}`);
        }
      }

      const issueList = issues.length > 0
        ? '\n\nDoc issues:\n' + issues.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')
        : '';

      return createPreToolUseBlock(
        'Codex doc-review FAIL',
        `⛔ CODEX DOC-REVIEW GATE: doc-review returned FAIL

Verdict: FAIL
Summary: ${result.summary || 'No summary'}${issueList}

Fix the documentation issues before transitioning to EXECUTION.`
      );
    }

    // PASS or SKIP — allow through
    return null;
  } catch {
    // Corrupt result file — allow (graceful degradation)
    return null;
  }
}

/**
 * Main hook logic
 * @returns {Promise<void>}
 */
async function main() {
  // Import here to get path utilities
  const { getSessionFile } = require('../lib/session-utils.js');
  const { outputAndExit } = require('../lib/hook-utils.js');

  const hookInput = await parseHookInput();
  if (!hookInput) {
    outputAndExit(createPreToolUseAllow());
  }

  // Extract tool name
  const toolName = hookInput.tool_name || '';
  const toolNameLower = toolName.toLowerCase();

  // Extract session ID
  const sessionId = hookInput.session_id;

  // =========================================================================
  // Session file tamper protection (all phases)
  // =========================================================================
  if (toolNameLower === 'bash') {
    const command = hookInput.tool_input?.command || '';

    if (sessionId && command) {
      const sessionDir = getSessionDir(sessionId);
      const protectedPatterns = [
        path.join(sessionDir, 'session.json'),
        path.join(sessionDir, 'evidence', 'log.jsonl'),
        path.join(sessionDir, 'tasks'),
      ];

      const isProtectedAccess = protectedPatterns.some(p => command.includes(p));

      if (isProtectedAccess) {
        // Allow read-only commands (cat, head, tail, wc, grep, less, jq with no redirect)
        const readOnlyPattern = /^(cat|head|tail|wc|grep|less|jq)\s/;
        const hasWriteRedirect = /[>|].*(?:tee|>>|>)/.test(command) || />\s/.test(command);

        if (!readOnlyPattern.test(command.trim()) || hasWriteRedirect) {
          outputAndExit(createPreToolUseBlock(
            'Direct modification of session files is not allowed.',
            `Direct modification of session files is not allowed.\nUse the provided scripts instead:\n  - session-update.js for session state\n  - task-update.js for task state\n  - Evidence is collected automatically by hooks.`
          ));
          return;
        }
      }
    }
  }

  // =========================================================================
  // Codex result file protection: block manual rm of codex result files
  // =========================================================================
  if (toolNameLower === 'bash' && sessionId) {
    const command = hookInput.tool_input?.command || '';

    const codexResultPath = getCodexResultPath(sessionId);
    const codexDocResultPath = getCodexDocResultPath(sessionId);

    // Detect rm/unlink as a command (at start or after shell separators like &&, ||, ;, |)
    const isRmCommand = /(^|[;&|]\s*)(rm|unlink)\b/.test(command.trim());
    const targetsCodexFile = command.includes(codexResultPath) || command.includes(codexDocResultPath) ||
      command.includes(`/tmp/codex-${sessionId}`) || command.includes(`/tmp/codex-doc-${sessionId}`);

    if (isRmCommand && targetsCodexFile) {
      outputAndExit(createPreToolUseBlock(
        'Manual deletion of Codex result files is not allowed',
        `CODEX FILE PROTECTION: Manual deletion blocked

Target: ${command}

WHY BLOCKED:
Codex result files are managed automatically by codex-verify.js.
Manual deletion can bypass verification gates and create inconsistent state.

WHAT TO DO INSTEAD:
- Re-run codex-verify.js (it auto-cleans old results before running)
- Or use session-update.js --phase EXECUTION (auto-cleans on phase transition)`
      ));
      return;
    }
  }

  // =========================================================================
  // Codex gate: block --verifier-passed without Codex result
  // =========================================================================
  if (toolNameLower === 'bash' && sessionId) {
    const command = hookInput.tool_input?.command || '';

    if (command.includes('session-update') && command.includes('--verifier-passed')) {
      const resultPath = getCodexResultPath(sessionId);

      if (!fs.existsSync(resultPath)) {
        // If Codex is not installed, allow through (graceful degradation)
        if (!isCodexInstalled()) {
          // No Codex, no gate — allow verifier-passed
        } else {
          outputAndExit(createPreToolUseBlock(
            'Codex verification not completed',
            `⛔ CODEX GATE: Codex verification result not found

Expected file: ${resultPath}

Codex CLI is installed but verification has not been run.
The Codex verification must complete before transitioning to DOCUMENTATION.

WHAT TO DO:
1. Launch Codex verification in Phase 0
2. Wait for completion: TaskOutput(background_task_id, block=True, timeout=300000)
3. Read the result: cat ${resultPath}
4. Retry this command`
          ));
          return;
        }
      }

      try {
        const result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));

        if (result.verdict === 'FAIL') {
          const issues = [];
          if (result.review?.issues?.length) {
            issues.push(...result.review.issues.slice(0, 5));
          }
          if (result.exec?.criteria_results) {
            for (const cr of result.exec.criteria_results) {
              if (cr.result === 'FAIL') issues.push(`${cr.criterion}: ${cr.explanation}`);
            }
          }
          if (result.doc_review?.doc_issues) {
            for (const i of result.doc_review.doc_issues) {
              if (i.severity === 'error') issues.push(`[${i.category}] ${i.detail}`);
            }
          }

          const issueList = issues.length > 0
            ? '\n\nIssues:\n' + issues.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')
            : '';

          outputAndExit(createPreToolUseBlock(
            'Codex verification FAIL',
            `⛔ CODEX GATE: Codex verification returned FAIL

Verdict: FAIL
Summary: ${result.summary || 'No summary'}${issueList}

Create fix tasks and transition to EXECUTION instead.`
          ));
          return;
        }

        // PASS or SKIP — allow through
      } catch {
        // Corrupt result file — allow (graceful degradation)
      }
    }
  }

  // =========================================================================
  // Codex doc-review gate: block PLANNING→EXECUTION without doc-review result
  // =========================================================================
  if (toolNameLower === 'bash' && sessionId) {
    const command = hookInput.tool_input?.command || '';
    const docGateResult = checkCodexDocGate(sessionId, command);
    if (docGateResult) {
      outputAndExit(docGateResult);
      return;
    }
  }

  // Only process Edit and Write tools for remaining checks
  if (toolName !== 'Edit' && toolName !== 'Write') {
    outputAndExit(createPreToolUseAllow());
  }

  // No session - allow
  if (!sessionId) {
    outputAndExit(createPreToolUseAllow());
  }

  // Check if session is active
  if (!isSessionActive(sessionId)) {
    outputAndExit(createPreToolUseAllow());
  }

  // Get session file path for error message
  const sessionFile = getSessionFile(sessionId);

  // Get session phase (optimized: only reads phase field, not full JSON)
  /** @type {string} */
  let phase;
  try {
    phase = readSessionField(sessionId, 'phase') || 'unknown';
  } catch {
    // Session file error - allow
    outputAndExit(createPreToolUseAllow());
  }

  // Get file path from tool input
  const filePath = hookInput.tool_input?.file_path || '';

  // =========================================================================
  // Phase 1: PLANNING phase enforcement
  // =========================================================================
  if (phase === 'PLANNING') {
    // Check if file is allowed during PLANNING
    if (isFileAllowed(filePath)) {
      outputAndExit(createPreToolUseAllow());
    }

    // Block with clear message including session details
    outputAndExit(createDenialResponse(toolName, filePath, sessionId, sessionFile));
  }

  // =========================================================================
  // Phase 2: TDD enforcement during EXECUTION phase
  // =========================================================================
  if (phase === 'EXECUTION') {
    // Check for current TDD task
    const tddTask = getCurrentTddTask(sessionId);

    if (tddTask) {
      // If writing to a non-test file, check TDD-RED evidence
      if (!isTestFile(filePath) && !isFileAllowed(filePath)) {
        // Check if TDD-RED evidence exists
        if (!hasTddRedEvidence(tddTask)) {
          // Block: trying to write implementation before test
          outputAndExit(createTddViolationResponse(toolName, filePath, tddTask));
        }
      }
    }
  }

  // Allow all other cases
  outputAndExit(createPreToolUseAllow());
}

// Entry point - only run when executed directly
if (require.main === module) {
  runHook(main, createPreToolUseAllow);
}

// Export for testing
module.exports = { getCodexResultPath, getCodexDocResultPath, checkCodexDocGate, isCodexInstalled };
