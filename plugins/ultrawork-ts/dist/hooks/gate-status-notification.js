#!/usr/bin/env node
"use strict";
/**
 * Gate Status Notification Hook (PostToolUse)
 * Notifies AI when exploration_stage changes (gates unlock)
 * v1.0: TypeScript port from bash version
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const session_utils_1 = require("../lib/session-utils");
/**
 * Read all stdin data
 */
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return chunks.join('');
}
/**
 * Create empty response
 */
function createEmptyResponse() {
    return {
        hookSpecificOutput: {
            hookEventName: 'PostToolUse'
        }
    };
}
/**
 * Create notification response
 */
function createNotificationResponse(message) {
    return {
        hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: message
        }
    };
}
/**
 * Check if this was an explorer task
 */
function isExplorerTask(hookInput) {
    const subagentType = hookInput.tool_input?.subagent_type || '';
    const toolResponse = hookInput.tool_response || '';
    return (subagentType.includes('explorer') ||
        toolResponse.includes('EXPLORER_ID') ||
        toolResponse.includes('exploration'));
}
/**
 * Main hook logic
 */
async function main() {
    try {
        // Read stdin JSON
        const input = await readStdin();
        const hookInput = JSON.parse(input);
        // Extract tool name
        const toolName = hookInput.tool_name || '';
        // Only process Task tool completions
        if (toolName !== 'Task' && toolName !== 'task') {
            console.log(JSON.stringify(createEmptyResponse()));
            process.exit(0);
            return;
        }
        // Extract session ID
        const sessionId = hookInput.session_id;
        // No session - exit
        if (!sessionId) {
            console.log(JSON.stringify(createEmptyResponse()));
            process.exit(0);
            return;
        }
        // Get session directory and file
        const sessionDir = (0, session_utils_1.getSessionDir)(sessionId);
        const sessionFile = (0, session_utils_1.getSessionFile)(sessionId);
        // Session file doesn't exist - exit
        if (!fs.existsSync(sessionFile)) {
            console.log(JSON.stringify(createEmptyResponse()));
            process.exit(0);
            return;
        }
        // Read session data
        let session;
        try {
            const content = fs.readFileSync(sessionFile, 'utf-8');
            session = JSON.parse(content);
        }
        catch {
            console.log(JSON.stringify(createEmptyResponse()));
            process.exit(0);
            return;
        }
        const phase = session.phase || '';
        const explorationStage = session.exploration_stage || 'not_started';
        // Only notify during PLANNING phase
        if (phase !== 'PLANNING') {
            console.log(JSON.stringify(createEmptyResponse()));
            process.exit(0);
            return;
        }
        // Check if this was an explorer task
        if (isExplorerTask(hookInput)) {
            // Check for overview.md to detect overview completion
            const overviewPath = path.join(sessionDir, 'exploration', 'overview.md');
            if (fs.existsSync(overviewPath) && explorationStage === 'not_started') {
                // Update exploration_stage to "overview"
                await (0, session_utils_1.updateSession)(sessionId, (s) => ({
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
                let context;
                try {
                    const contextContent = fs.readFileSync(contextPath, 'utf-8');
                    context = JSON.parse(contextContent);
                }
                catch {
                    console.log(JSON.stringify(createEmptyResponse()));
                    process.exit(0);
                    return;
                }
                const explorationComplete = context.exploration_complete || false;
                if (explorationComplete && explorationStage !== 'complete') {
                    // Update exploration_stage to "complete"
                    await (0, session_utils_1.updateSession)(sessionId, (s) => ({
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
5. Create tasks with task-create.sh
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
session-update.sh --session SESSION_DIR --phase EXECUTION`;
                console.log(JSON.stringify(createNotificationResponse(message)));
                process.exit(0);
                return;
            }
        }
        // No notification needed
        console.log(JSON.stringify(createEmptyResponse()));
        process.exit(0);
    }
    catch (err) {
        // On error, output empty response
        console.log(JSON.stringify(createEmptyResponse()));
        process.exit(0);
    }
}
// Handle stdin
if (process.stdin.isTTY) {
    // No stdin available, output empty response
    console.log(JSON.stringify(createEmptyResponse()));
    process.exit(0);
}
else {
    // Read stdin and process
    process.stdin.setEncoding('utf8');
    main().catch(() => {
        // On error, output empty response
        console.log(JSON.stringify(createEmptyResponse()));
        process.exit(0);
    });
}
//# sourceMappingURL=gate-status-notification.js.map