#!/usr/bin/env node
"use strict";
/**
 * Stop Hook - Validates evidence sufficiency on conversation stop
 * Prevents premature exit when ultrawork session is active without verification
 * TypeScript port from bash version
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
// ============================================================================
// Utilities
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
 * Count completed tasks from tasks directory
 */
function countCompletedTasks(sessionDir) {
    const tasksDir = path.join(sessionDir, 'tasks');
    if (!fs.existsSync(tasksDir)) {
        return 0;
    }
    let completed = 0;
    const files = fs.readdirSync(tasksDir);
    for (const file of files) {
        if (!file.endsWith('.json')) {
            continue;
        }
        const filePath = path.join(tasksDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const task = JSON.parse(content);
            if (task.status === 'resolved') {
                completed++;
            }
        }
        catch {
            // Skip invalid task files
            continue;
        }
    }
    return completed;
}
/**
 * Count pending and in-progress tasks
 */
function countActiveTasks(sessionDir) {
    const tasksDir = path.join(sessionDir, 'tasks');
    if (!fs.existsSync(tasksDir)) {
        return { pending: 0, inProgress: 0 };
    }
    let pending = 0;
    let inProgress = 0;
    const files = fs.readdirSync(tasksDir);
    for (const file of files) {
        if (!file.endsWith('.json')) {
            continue;
        }
        const filePath = path.join(tasksDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const task = JSON.parse(content);
            if (task.status === 'open' || task.status === 'pending') {
                pending++;
            }
            else if (task.status === 'in_progress') {
                inProgress++;
            }
        }
        catch {
            continue;
        }
    }
    return { pending, inProgress };
}
/**
 * Check for blocked phrases in recent evidence
 */
function checkBlockedPhrases(session) {
    const blockedPhrases = [
        'should work',
        'probably works',
        'basic implementation',
        'TODO:',
        'FIXME:',
        'you can extend'
    ];
    // Check last 5 evidence entries
    const recentEvidence = session.evidence_log.slice(-5);
    for (const evidence of recentEvidence) {
        // Check output_preview field if it exists
        const output = evidence.output_preview || '';
        for (const phrase of blockedPhrases) {
            if (output.toLowerCase().includes(phrase.toLowerCase())) {
                return phrase;
            }
        }
    }
    return null;
}
/**
 * Output hook response and exit
 */
function outputAndExit(output) {
    console.log(JSON.stringify(output));
    process.exit(0);
}
// ============================================================================
// Main Hook Logic
// ============================================================================
async function main() {
    try {
        // Read stdin JSON
        const input = await readStdin();
        const hookInput = JSON.parse(input);
        // Extract session_id
        const sessionId = hookInput.session_id;
        // No session_id - allow exit
        if (!sessionId) {
            outputAndExit({});
            return;
        }
        // Get session file
        const sessionFile = (0, session_utils_1.getSessionFile)(sessionId);
        // Session file doesn't exist - not an ultrawork session, allow exit
        if (!fs.existsSync(sessionFile)) {
            outputAndExit({});
            return;
        }
        // Parse session state
        const content = fs.readFileSync(sessionFile, 'utf-8');
        const session = JSON.parse(content);
        const phase = session.phase || 'unknown';
        const goal = session.goal || 'unknown';
        const skipVerify = session.options?.skip_verify || false;
        const planOnly = session.options?.plan_only || false;
        const autoMode = session.options?.auto_mode || false;
        // Terminal states - allow exit
        const terminalPhases = ['COMPLETE', 'CANCELLED', 'FAILED'];
        if (terminalPhases.includes(phase)) {
            outputAndExit({});
            return;
        }
        // Plan-only mode - allow exit after planning
        if (planOnly && phase !== 'PLANNING') {
            outputAndExit({});
            return;
        }
        // Skip-verify mode - allow exit after execution if tasks done
        if (skipVerify && phase === 'EXECUTION') {
            const sessionDir = (0, session_utils_1.getSessionDir)(sessionId);
            const { pending, inProgress } = countActiveTasks(sessionDir);
            if (pending === 0 && inProgress === 0) {
                outputAndExit({});
                return;
            }
        }
        // Interactive mode planning - orchestrator does planning inline, don't block
        if (phase === 'PLANNING' && !autoMode) {
            outputAndExit({});
            return;
        }
        // Check for blocked phrases in recent evidence
        const blockedPhrase = checkBlockedPhrases(session);
        if (blockedPhrase) {
            outputAndExit({
                decision: 'block',
                reason: `INCOMPLETE WORK DETECTED

Session ID: ${sessionId}
Goal: ${goal}

Blocked phrase found: "${blockedPhrase}"

Detected blocked phrase in recent outputs. Complete work before exiting.

ZERO TOLERANCE RULES:
✗ No "should work" - require command output evidence
✗ No "basic implementation" - complete work only
✗ No TODO/FIXME in code - finish everything

Commands:
  /ultrawork-status   - Check progress
  /ultrawork-evidence - View evidence
  /ultrawork-cancel   - Cancel session`,
                systemMessage: `⚠️ ULTRAWORK [${sessionId}]: Incomplete work detected`
            });
            return;
        }
        // For EXECUTION phase, require evidence for completed tasks
        if (phase === 'EXECUTION') {
            const sessionDir = (0, session_utils_1.getSessionDir)(sessionId);
            const completedTasks = countCompletedTasks(sessionDir);
            const evidenceCount = session.evidence_log.length;
            // Require at least 1 evidence entry per completed task
            if (completedTasks > 0 && evidenceCount < completedTasks) {
                outputAndExit({
                    decision: 'block',
                    reason: `INSUFFICIENT EVIDENCE

Session ID: ${sessionId}
Goal: ${goal}
Completed tasks: ${completedTasks}
Evidence collected: ${evidenceCount}

Completed tasks without sufficient evidence. Found ${evidenceCount} evidence entries for ${completedTasks} completed tasks.

Every completed task requires evidence:
• Test results (command output)
• File operations (read/write/edit)
• Verification commands

Commands:
  /ultrawork-status   - Check progress
  /ultrawork-evidence - View evidence
  /ultrawork-cancel   - Cancel session`,
                    systemMessage: `⚠️ ULTRAWORK [${sessionId}]: Insufficient evidence`
                });
                return;
            }
        }
        // Active session not complete - block exit with phase-specific message
        let reason = '';
        let systemMsg = '';
        switch (phase) {
            case 'PLANNING':
                // Only reaches here if AUTO_MODE is true (planner agent running in background)
                reason = 'Planner agent is creating task graph. Wait for planning to complete or use /ultrawork-cancel.';
                systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Planning in progress for '${goal}'`;
                break;
            case 'EXECUTION':
                reason = 'Workers are implementing tasks. Wait for execution to complete or use /ultrawork-cancel.';
                systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Execution in progress for '${goal}'`;
                break;
            case 'VERIFICATION':
                reason = 'Verifier is checking evidence. Wait for verification to complete or use /ultrawork-cancel.';
                systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Verification in progress for '${goal}'`;
                break;
            default:
                reason = `Ultrawork session is active (phase: ${phase}). Complete the session or use /ultrawork-cancel.`;
                systemMsg = `⚠️ ULTRAWORK [${sessionId}]: Session active for '${goal}'`;
                break;
        }
        const evidenceCount = session.evidence_log.length;
        outputAndExit({
            decision: 'block',
            reason: `ULTRAWORK SESSION ACTIVE

Session ID: ${sessionId}
Goal: ${goal}
Phase: ${phase}
Evidence collected: ${evidenceCount}

${reason}

Commands:
  /ultrawork-status   - Check progress
  /ultrawork-evidence - View evidence
  /ultrawork-cancel   - Cancel session`,
            systemMessage: systemMsg
        });
    }
    catch (err) {
        // Even on error, output minimal valid JSON and exit 0
        outputAndExit({});
    }
}
// ============================================================================
// Entry Point
// ============================================================================
// Handle stdin
if (process.stdin.isTTY) {
    // No stdin available, output minimal response
    console.log('{}');
    process.exit(0);
}
else {
    // Read stdin and process
    process.stdin.setEncoding('utf8');
    main().catch(() => {
        // On error, output minimal valid JSON and exit 0
        console.log('{}');
        process.exit(0);
    });
}
//# sourceMappingURL=stop-hook.js.map