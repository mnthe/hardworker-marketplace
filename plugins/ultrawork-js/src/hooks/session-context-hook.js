#!/usr/bin/env node

/**
 * Ultrawork Session Context Hook
 * Injects session state into every user message when ultrawork is active
 * v1.0: JavaScript version with JSDoc types
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir, getSessionFile } = require('../lib/session-utils.js');

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').Phase} Phase
 * @typedef {import('../lib/types.js').ExplorationStage} ExplorationStage
 */

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 */

/**
 * @typedef {Object} HookOutput
 * @property {Object} hookSpecificOutput
 * @property {string} hookSpecificOutput.hookEventName
 * @property {string} [hookSpecificOutput.additionalContext]
 */

/**
 * @typedef {Object} TaskFile
 * @property {string} id
 * @property {string} status
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
 * Count tasks in session tasks directory
 * @param {string} sessionDir
 * @returns {number}
 */
function countTasks(sessionDir) {
  const tasksDir = path.join(sessionDir, 'tasks');

  if (!fs.existsSync(tasksDir)) {
    return 0;
  }

  try {
    const files = fs.readdirSync(tasksDir);
    return files.filter(f => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

/**
 * Count evidence entries in session
 * @param {Session} session
 * @returns {number}
 */
function countEvidence(session) {
  return session.evidence_log?.length || 0;
}

/**
 * Build next action message based on phase and exploration stage
 * @param {Phase} phase
 * @param {ExplorationStage} explorationStage
 * @param {boolean} autoMode
 * @param {number} maxWorkers
 * @returns {string}
 */
function buildNextAction(phase, explorationStage, autoMode, maxWorkers) {
  switch (phase) {
    case 'PLANNING':
      if (autoMode) {
        return `1. Wait for planner agent to complete task graph
2. Once planner returns, update session.json with child_tasks
3. Transition to EXECUTION phase`;
      } else {
        // Gate system for interactive planning
        switch (explorationStage) {
          case 'not_started':
            return `⛔ GATE SYSTEM - Skill-based Exploration

┌─ GATE 1: OVERVIEW [CURRENT] ────────────────────────┐
│                                                      │
│ FIRST ACTION (required):                             │
│ Skill(skill="ultrawork:overview-exploration")        │
│                                                      │
│ Direct exploration (no agent spawn):                 │
│ ✓ Use Glob, Read, Grep to understand project        │
│ ✓ Write overview.md                                  │
│ ✗ No file edits (Edit, Write - except overview.md)  │
│                                                      │
│ Follow the procedure guided by the skill.           │
└──────────────────────────────────────────────────────┘

┌─ GATE 2: TARGETED EXPLORATION [LOCKED] ─────────────┐
│ Unlocks when: overview.md exists                     │
│ Agent: Task(subagent_type="ultrawork:explorer")      │
└──────────────────────────────────────────────────────┘

┌─ GATE 3: PLANNING [LOCKED] ─────────────────────────┐
│ Unlocks when: exploration_stage == "complete"        │
└──────────────────────────────────────────────────────┘

┌─ GATE 4: EXECUTION [LOCKED] ────────────────────────┐
│ Unlocks when: design.md + tasks/*.json exist         │
└──────────────────────────────────────────────────────┘`;

          case 'overview':
            return `⛔ GATE SYSTEM - You CANNOT skip gates

┌─ GATE 1: EXPLORATION [COMPLETE] ✓ ──────────────────┐
└──────────────────────────────────────────────────────┘

┌─ GATE 2: TARGETED EXPLORATION [CURRENT] ────────────┐
│                                                      │
│ 1. Read exploration/overview.md                      │
│ 2. Analyze goal + overview → generate search hints   │
│ 3. Spawn targeted explorers (parallel in single msg) │
│                                                      │
│ ALLOWED: Read overview.md, spawn explorers           │
│ BLOCKED: Direct exploration, file edits              │
└──────────────────────────────────────────────────────┘

┌─ GATE 3: PLANNING [LOCKED] ─────────────────────────┐
│ Unlocks when: exploration_stage == "complete"        │
└──────────────────────────────────────────────────────┘`;

          case 'analyzing':
          case 'targeted':
            return `⛔ GATE SYSTEM

┌─ GATE 1-2: EXPLORATION [IN PROGRESS] ───────────────┐
│ Stage: ${explorationStage}                            │
│ Wait for all explorers to complete                   │
└──────────────────────────────────────────────────────┘

┌─ GATE 3: PLANNING [LOCKED] ─────────────────────────┐
│ Unlocks when: exploration_stage == "complete"        │
└──────────────────────────────────────────────────────┘`;

          case 'complete':
            return `⛔ GATE SYSTEM

┌─ GATE 1-2: EXPLORATION [COMPLETE] ✓ ────────────────┐
└──────────────────────────────────────────────────────┘

┌─ GATE 3: PLANNING [CURRENT] ────────────────────────┐
│                                                      │
│ 1. Read context.json and exploration/*.md            │
│ 2. Present findings to user                          │
│ 3. AskUserQuestion for clarifications                │
│ 4. Write design.md                                   │
│ 5. Create tasks with task-create.sh (NOT TodoWrite)  │
│ 6. Get user approval                                 │
│                                                      │
│ ALLOWED: Read exploration/*, AskUserQuestion,        │
│          Write design.md, task-create.sh             │
│ BLOCKED: Direct code edits, TodoWrite for tasks      │
└──────────────────────────────────────────────────────┘

┌─ GATE 4: EXECUTION [LOCKED] ────────────────────────┐
│ Unlocks when: design.md + tasks/*.json + approval    │
└──────────────────────────────────────────────────────┘`;

          default:
            return `Unknown exploration_stage: ${explorationStage} - check session.json`;
        }
      }

    case 'EXECUTION':
      return `1. Check which child tasks are unblocked (no pending dependencies)
2. Spawn worker agents for unblocked tasks (max: ${maxWorkers || 'unlimited'})
3. Collect evidence from completed workers
4. Update session.json with evidence_log entries
5. When ALL tasks complete, transition to VERIFICATION phase`;

    case 'VERIFICATION':
      return `1. Spawn verifier agent to validate all criteria
2. Verifier checks evidence_log against success criteria
3. Verifier scans for blocked patterns
4. If PASS: mark phase=COMPLETE
5. If FAIL: mark phase=FAILED with failure_reason`;

    default:
      return `Unknown phase - check session.json`;
  }
}

/**
 * Build context message for active session
 * @param {string} sessionId
 * @param {Session} session
 * @param {number} taskCount
 * @param {number} evidenceCount
 * @param {string} sessionFile
 * @returns {string}
 */
function buildContextMessage(sessionId, session, taskCount, evidenceCount, sessionFile) {
  const {
    goal,
    phase,
    exploration_stage: explorationStage,
    options
  } = session;

  const { auto_mode, skip_verify, plan_only, max_workers } = options;

  const nextAction = buildNextAction(
    phase,
    explorationStage,
    auto_mode,
    max_workers
  );

  return `<ultrawork-session>
╔═══════════════════════════════════════════════════════════╗
║ ⚠️  ULTRAWORK SESSION ACTIVE - DO NOT IGNORE THIS         ║
║                                                           ║
║ This message persists across conversation compaction.     ║
║ You MUST follow the ultrawork protocol below.             ║
║ If unsure about previous context, read session.json.      ║
╚═══════════════════════════════════════════════════════════╝

Session ID: ${sessionId}
Goal: ${goal}
Phase: ${phase}
Exploration: ${explorationStage}
Tasks: ${taskCount}
Evidence: ${evidenceCount} items

Options:
  auto_mode: ${auto_mode}
  skip_verify: ${skip_verify}
  plan_only: ${plan_only}
  max_workers: ${max_workers || 0}

───────────────────────────────────────────────────────────
NEXT ACTIONS REQUIRED:
${nextAction}

───────────────────────────────────────────────────────────
ZERO TOLERANCE RULES (ENFORCED):
✗ No "should work" - require command output evidence
✗ No "basic implementation" - complete work only
✗ No TODO/FIXME in code - finish everything
✗ No completion without verification

───────────────────────────────────────────────────────────
SESSION FILE OPERATIONS:

To update session state, use:
  Session file: ${sessionFile}

To read current state:
  jq '.' "${sessionFile}"

───────────────────────────────────────────────────────────
COMMANDS:
  /ultrawork-status   - Check detailed progress
  /ultrawork-evidence - View collected evidence
  /ultrawork-cancel   - Cancel session

</ultrawork-session>`;
}

/**
 * Main hook logic
 * @returns {Promise<void>}
 */
async function main() {
  try {
    // Read stdin JSON
    const input = await readStdin();
    /** @type {HookInput} */
    const hookInput = JSON.parse(input);

    // Extract session_id
    const sessionId = hookInput.session_id;

    // No session_id in stdin - no injection needed
    if (!sessionId) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit'
        }
      }));
      process.exit(0);
      return;
    }

    // Get session file
    const sessionDir = getSessionDir(sessionId);
    const sessionFile = getSessionFile(sessionId);

    // Session file doesn't exist - provide session_id for new sessions
    if (!fs.existsSync(sessionFile)) {
      /** @type {HookOutput} */
      const output = {
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: `CLAUDE_SESSION_ID: ${sessionId}\nUse this when calling ultrawork scripts: --session ${sessionId}`
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
      return;
    }

    // Parse session state
    const sessionContent = fs.readFileSync(sessionFile, 'utf-8');
    /** @type {Session} */
    const session = JSON.parse(sessionContent);

    const phase = session.phase || 'unknown';

    // Terminal states - no injection needed
    if (phase === 'COMPLETE' || phase === 'CANCELLED' || phase === 'FAILED') {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit'
        }
      }));
      process.exit(0);
      return;
    }

    // Count tasks and evidence
    const taskCount = countTasks(sessionDir);
    const evidenceCount = countEvidence(session);

    // Build and output context message
    const contextMsg = buildContextMessage(
      sessionId,
      session,
      taskCount,
      evidenceCount,
      sessionFile
    );

    /** @type {HookOutput} */
    const output = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: contextMsg
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Even on error, output minimal valid JSON and exit 0
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit'
      }
    }));
    process.exit(0);
  }
}

// Handle stdin
if (process.stdin.isTTY) {
  // No stdin available, output minimal response
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit'
    }
  }));
  process.exit(0);
} else {
  // Read stdin and process
  process.stdin.setEncoding('utf8');
  main().catch(() => {
    // On error, output minimal valid JSON and exit 0
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit'
      }
    }));
    process.exit(0);
  });
}
