#!/usr/bin/env bun

/**
 * Ultrawork Post-Compaction Recovery Hook
 * Injects procedural knowledge after conversation compaction
 * v1.0: JavaScript version with JSDoc types
 */

const fs = require('fs');
const path = require('path');
const { getSessionFile } = require('../lib/session-utils.js');
const { readStdin, createSessionStart, runHook } = require('../lib/hook-utils.js');

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
 * Build delegation rules table
 * @returns {string} Delegation rules markdown table
 */
function buildDelegationRules() {
  return `| Phase       | Tool Call                                      |
|-------------|------------------------------------------------|
| Exploration | Task(subagent_type="ultrawork:explorer", ...)  |
| Execution   | Task(subagent_type="ultrawork:worker", ...)    |
| Verification| Task(subagent_type="ultrawork:verifier", ...)  |

⚠️ NEVER execute tasks directly - always delegate to sub-agents`;
}

/**
 * Build context variables template
 * @param {string} sessionId - Session ID
 * @param {string} scriptsPath - Scripts directory path
 * @param {string} workingDir - Working directory path
 * @returns {string} Context variables template
 */
function buildContextVarsTemplate(sessionId, scriptsPath, workingDir) {
  return `\`\`\`python
Task(
  subagent_type="ultrawork:worker",
  prompt=f"""
CLAUDE_SESSION_ID: ${sessionId}
SCRIPTS_PATH: ${scriptsPath}
WORKING_DIR: ${workingDir}
TASK_ID: {task_id}
...
"""
)
\`\`\``;
}

/**
 * Build phase-specific instructions
 * @param {Phase} phase - Current phase
 * @param {ExplorationStage} explorationStage - Exploration stage
 * @param {string} sessionId - Session ID
 * @param {string} scriptsPath - Scripts directory path
 * @returns {string} Phase-specific instructions
 */
function buildPhaseInstructions(phase, explorationStage, sessionId, scriptsPath) {
  switch (phase) {
    case 'PLANNING':
      if (explorationStage === 'not_started') {
        return `Check exploration_stage first:
- not_started: Run Skill(skill="ultrawork:overview-exploration")
- complete: Read exploration/*.md, design tasks, create with task-create.js
- other: Check context.json for progress`;
      } else if (explorationStage === 'complete') {
        return `Exploration complete. Next steps:
1. Read exploration/*.md and context.json
2. Present findings to user
3. AskUserQuestion for clarifications
4. Write design.md to docs/plans/
5. Create tasks with task-create.js (NOT TodoWrite)
6. Get user approval`;
      } else {
        return `Exploration in progress (stage: ${explorationStage})
Wait for all explorers to complete before planning.`;
      }

    case 'EXECUTION':
      return `1. List tasks: bun "${scriptsPath}/task-list.js" --session ${sessionId} --format json
2. Find unblocked tasks (status=open, no pending blocked_by)
3. Spawn workers: Task(subagent_type="ultrawork:worker", ...)
4. When all tasks resolved: update phase to VERIFICATION`;

    case 'VERIFICATION':
      return `1. Spawn verifier: Task(subagent_type="ultrawork:verifier", ...)
2. Verifier will check evidence and run tests
3. PASS → phase=COMPLETE, FAIL → phase=EXECUTION (Ralph loop)`;

    case 'COMPLETE':
      return `Session complete. Review results with /ultrawork-status`;

    case 'CANCELLED':
      return `Session cancelled. Start new session with /ultrawork "goal"`;

    case 'FAILED':
      return `Session failed. Review failure_reason in session.json`;

    default:
      return `Unknown phase - check session.json`;
  }
}

/**
 * Build recovery message
 * @param {string} sessionId - Session ID
 * @param {Phase} phase - Current phase
 * @param {ExplorationStage} explorationStage - Exploration stage
 * @param {string} scriptsPath - Scripts directory path
 * @param {string} workingDir - Working directory path
 * @returns {string} Recovery message
 */
function buildRecoveryMessage(sessionId, phase, explorationStage, scriptsPath, workingDir) {
  const delegationRules = buildDelegationRules();
  const contextVars = buildContextVarsTemplate(sessionId, scriptsPath, workingDir);
  const phaseInstructions = buildPhaseInstructions(phase, explorationStage, sessionId, scriptsPath);

  return `<ultrawork-recovery>
╔═══════════════════════════════════════════════════════════╗
║ 🔄 ULTRAWORK CONTEXT RESTORED AFTER COMPACTION            ║
╚═══════════════════════════════════════════════════════════╝

Session ID: ${sessionId}
Phase: ${phase}
Exploration Stage: ${explorationStage}

───────────────────────────────────────────────────────────
CRITICAL: DELEGATION RULES (MANDATORY)
───────────────────────────────────────────────────────────

You MUST use the Task tool for all execution:

${delegationRules}

───────────────────────────────────────────────────────────
CONTEXT VARIABLES FOR SUB-AGENTS
───────────────────────────────────────────────────────────

All sub-agents MUST receive these in their prompt:
${contextVars}

───────────────────────────────────────────────────────────
CURRENT PHASE: ${phase}
───────────────────────────────────────────────────────────

${phaseInstructions}

───────────────────────────────────────────────────────────
STATE RETRIEVAL
───────────────────────────────────────────────────────────

To check current state:
\`\`\`bash
bun "${scriptsPath}/session-get.js" --session ${sessionId}
bun "${scriptsPath}/task-list.js" --session ${sessionId} --format table
bun "${scriptsPath}/context-get.js" --session ${sessionId} --summary
\`\`\`

NEVER use Read on session.json - always use scripts.

</ultrawork-recovery>`;
}

/**
 * Main hook logic
 * @returns {Promise<void>}
 */
async function main() {
  // Read stdin JSON
  const input = await readStdin();
  /** @type {HookInput} */
  const hookInput = JSON.parse(input);

  // Extract session_id
  const sessionId = hookInput.session_id;

  // No session_id - no injection needed
  if (!sessionId) {
    console.log(JSON.stringify(createSessionStart()));
    process.exit(0);
    return;
  }

  // Get session file
  const sessionFile = getSessionFile(sessionId);

  // Session doesn't exist - no injection needed
  if (!fs.existsSync(sessionFile)) {
    console.log(JSON.stringify(createSessionStart()));
    process.exit(0);
    return;
  }

  // Parse session state
  const sessionContent = fs.readFileSync(sessionFile, 'utf-8');
  /** @type {Session} */
  const session = JSON.parse(sessionContent);

  const phase = session.phase || 'unknown';
  const explorationStage = session.exploration_stage || 'not_started';

  // Terminal states - no injection needed
  if (phase === 'COMPLETE' || phase === 'CANCELLED' || phase === 'FAILED') {
    console.log(JSON.stringify(createSessionStart()));
    process.exit(0);
    return;
  }

  // Get scripts path from environment (set by Claude Code when running hook)
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '';
  const scriptsPath = pluginRoot ? path.join(pluginRoot, 'src', 'scripts') : '${CLAUDE_PLUGIN_ROOT}/src/scripts';
  const workingDir = session.working_dir || process.cwd();

  // Build recovery message
  const recoveryMessage = buildRecoveryMessage(
    sessionId,
    phase,
    explorationStage,
    scriptsPath,
    workingDir
  );

  // Output with system message
  const output = createSessionStart(recoveryMessage);
  console.log(JSON.stringify(output));
  process.exit(0);
}

// Entry point
runHook(main, () => createSessionStart());
