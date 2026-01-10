#!/usr/bin/env node
"use strict";
/**
 * Agent Lifecycle Tracking Hook (PreToolUse)
 * Tracks when agents are spawned via Task tool during ultrawork sessions
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
const session_utils_1 = require("../lib/session-utils");
// ============================================================================
// Stdin/Stdout Functions
// ============================================================================
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
 * Output hook response (always allow)
 */
function outputAllow() {
    const output = {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
        },
    };
    console.log(JSON.stringify(output));
}
// ============================================================================
// Main Hook Logic
// ============================================================================
async function main() {
    try {
        // Read stdin JSON
        const input = await readStdin();
        const hookInput = JSON.parse(input);
        // Parse tool name
        const toolName = hookInput.tool_name || '';
        // Only process Task tool usage - exit silently for other tools
        if (toolName !== 'Task') {
            outputAllow();
            return;
        }
        // Get session ID from input
        const sessionId = hookInput.session_id;
        // No active ultrawork session - allow without tracking
        if (!sessionId) {
            outputAllow();
            return;
        }
        // Check if session file exists
        const sessionFile = (0, session_utils_1.getSessionFile)(sessionId);
        if (!fs.existsSync(sessionFile)) {
            outputAllow();
            return;
        }
        // Read session phase
        const content = fs.readFileSync(sessionFile, 'utf-8');
        const session = JSON.parse(content);
        const phase = session.phase || 'unknown';
        // Track during active phases (PLANNING, EXECUTION, VERIFICATION)
        const activePhases = ['PLANNING', 'EXECUTION', 'VERIFICATION'];
        if (!activePhases.includes(phase)) {
            outputAllow();
            return;
        }
        // Parse Task tool parameters
        const taskId = hookInput.tool_input?.task_id || '';
        const description = hookInput.tool_input?.description || '';
        // If no task_id, this isn't a worker spawn (might be TaskCreate, TaskUpdate, etc.)
        if (!taskId) {
            outputAllow();
            return;
        }
        // Log agent spawn attempt
        const timestamp = new Date().toISOString();
        // Update session with agent spawn tracking (with locking)
        try {
            await (0, session_utils_1.updateSession)(sessionId, (s) => {
                const evidence = {
                    type: 'agent_completed',
                    timestamp,
                    agent_id: 'spawning',
                    task_id: taskId,
                };
                // Add custom fields for spawn tracking
                const spawnEvidence = {
                    ...evidence,
                    type: 'agent_spawn_initiated',
                    description,
                };
                return {
                    ...s,
                    evidence_log: [...s.evidence_log, spawnEvidence],
                };
            });
        }
        catch {
            // Silently ignore update errors
        }
        // Allow the Task tool to proceed
        outputAllow();
    }
    catch {
        // Even on error, output allow and exit 0
        outputAllow();
    }
}
// ============================================================================
// Entry Point
// ============================================================================
// Handle stdin
if (process.stdin.isTTY) {
    // No stdin available, output allow response
    outputAllow();
    process.exit(0);
}
else {
    // Read stdin and process
    process.stdin.setEncoding('utf8');
    main()
        .then(() => process.exit(0))
        .catch(() => {
        // On error, output allow and exit 0
        outputAllow();
        process.exit(0);
    });
}
//# sourceMappingURL=agent-lifecycle-tracking.js.map