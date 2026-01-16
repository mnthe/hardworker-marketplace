#!/usr/bin/env bun

/**
 * Gate Status Notification Hook (PostToolUse)
 * Notifies AI when exploration_stage changes (gates unlock)
 * v1.0: JavaScript version with JSDoc types
 */

const fs = require('fs');
const path = require('path');
const { getSessionDir, getSessionFile, isSessionActive, updateSession } = require('../lib/session-utils.js');
const {
  readStdin,
  createPostToolUse,
  runHook
} = require('../lib/hook-utils.js');

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').Context} Context
 */

/**
 * @typedef {Object} ToolInput
 * @property {string} [subagent_type]
 */

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {string} [tool_name]
 * @property {ToolInput} [tool_input]
 * @property {string} [tool_response]
 */

/**
 * Create notification response
 * @param {string} message
 * @returns {Object}
 */
function createNotificationResponse(message) {
  const output = createPostToolUse();
  output.hookSpecificOutput.additionalContext = message;
  return output;
}

/**
 * Check if this was an explorer task
 * @param {HookInput} hookInput
 * @returns {boolean}
 */
function isExplorerTask(hookInput) {
  const subagentType = hookInput.tool_input?.subagent_type || '';
  const toolResponse = hookInput.tool_response || '';

  return (
    subagentType.includes('explorer') ||
    toolResponse.includes('EXPLORER_ID') ||
    toolResponse.includes('exploration')
  );
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

    // Extract tool name
    const toolName = hookInput.tool_name || '';

    // Only process Task tool completions
    if (toolName !== 'Task' && toolName !== 'task') {
      console.log(JSON.stringify(createPostToolUse()));
      process.exit(0);
      return;
    }

    // Extract session ID
    const sessionId = hookInput.session_id;

    // No session - exit
    if (!sessionId) {
      console.log(JSON.stringify(createPostToolUse()));
      process.exit(0);
      return;
    }

    // Get session directory and file
    const sessionDir = getSessionDir(sessionId);
    const sessionFile = getSessionFile(sessionId);

    // Session file doesn't exist - exit
    if (!fs.existsSync(sessionFile)) {
      console.log(JSON.stringify(createPostToolUse()));
      process.exit(0);
      return;
    }

    // Read session data
    /** @type {Session} */
    let session;
    try {
      const content = fs.readFileSync(sessionFile, 'utf-8');
      session = JSON.parse(content);
    } catch {
      console.log(JSON.stringify(createPostToolUse()));
      process.exit(0);
      return;
    }

    const phase = session.phase || '';
    const explorationStage = session.exploration_stage || 'not_started';

    // Only notify during PLANNING phase
    if (phase !== 'PLANNING') {
      console.log(JSON.stringify(createPostToolUse()));
      process.exit(0);
      return;
    }

    // Check if this was an explorer task
    if (isExplorerTask(hookInput)) {
      // Check for overview.md to detect overview completion
      const overviewPath = path.join(sessionDir, 'exploration', 'overview.md');

      if (fs.existsSync(overviewPath) && explorationStage === 'not_started') {
        // Update exploration_stage to "overview"
        await updateSession(sessionId, (s) => ({
          ...s,
          exploration_stage: 'overview'
        }));

        // Notify AI
        const message = `🔓 GATE UPDATE
═══════════════════════════════════════
GATE 1 (Overview) → COMPLETE ✓
GATE 2 (Targeted Exploration) → UNLOCKED
═══════════════════════════════════════

NEXT ACTION:
1. Read exploration/overview.md
2. Analyze goal + overview → generate hints
3. Spawn targeted explorers for each hint`;

        console.log(JSON.stringify(createNotificationResponse(message)));
        process.exit(0);
        return;
      }

      // Check context.json for exploration_complete
      const contextPath = path.join(sessionDir, 'context.json');

      if (fs.existsSync(contextPath)) {
        /** @type {Context} */
        let context;
        try {
          const contextContent = fs.readFileSync(contextPath, 'utf-8');
          context = JSON.parse(contextContent);
        } catch {
          console.log(JSON.stringify(createPostToolUse()));
          process.exit(0);
          return;
        }

        const explorationComplete = context.exploration_complete || false;

        if (explorationComplete && explorationStage !== 'complete') {
          // Update exploration_stage to "complete"
          await updateSession(sessionId, (s) => ({
            ...s,
            exploration_stage: 'complete'
          }));

          // Notify AI
          const message = `🔓 GATE UPDATE
═══════════════════════════════════════
GATE 1-2 (Exploration) → COMPLETE ✓
GATE 3 (Planning) → UNLOCKED
═══════════════════════════════════════

NEXT ACTION:
1. Read context.json and exploration/*.md
2. Present findings to user
3. AskUserQuestion for clarifications
4. Write design.md
5. Create tasks with task-create.js
6. Get user approval`;

          console.log(JSON.stringify(createNotificationResponse(message)));
          process.exit(0);
          return;
        }
      }
    }

    // Check for design.md and tasks to detect planning completion
    if (explorationStage === 'complete') {
      const designPath = path.join(sessionDir, 'design.md');
      const tasksDir = path.join(sessionDir, 'tasks');

      const designExists = fs.existsSync(designPath);
      let tasksExist = false;

      if (fs.existsSync(tasksDir)) {
        const taskFiles = fs.readdirSync(tasksDir);
        tasksExist = taskFiles.length > 0;
      }

      if (designExists && tasksExist) {
        // Notify AI that planning is complete
        const message = `🔓 GATE UPDATE
═══════════════════════════════════════
GATE 3 (Planning) → COMPLETE ✓
GATE 4 (Execution) → READY
═══════════════════════════════════════

NEXT ACTION:
Ask user for plan approval, then:
session-update.js --session SESSION_DIR --phase EXECUTION`;

        console.log(JSON.stringify(createNotificationResponse(message)));
        process.exit(0);
        return;
      }
    }

    // No notification needed
    console.log(JSON.stringify(createPostToolUse()));
    process.exit(0);
}

// Entry point
runHook(main, createPostToolUse);
