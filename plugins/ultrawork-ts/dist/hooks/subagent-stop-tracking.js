#!/usr/bin/env node
"use strict";
/**
 * Subagent Stop Tracking Hook
 * Captures worker agent results when they complete and updates session state
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
 * Output hook response
 */
function outputResponse() {
    const output = {
        hookSpecificOutput: {
            hookEventName: 'SubagentStop',
        },
    };
    console.log(JSON.stringify(output));
}
// ============================================================================
// Worker Detection
// ============================================================================
/**
 * Check if agent is tracked as ultrawork worker
 */
function isTrackedWorker(session, agentId) {
    const workers = session.workers || [];
    return workers.some((w) => w.agent_id === agentId);
}
/**
 * Check if task exists in session
 */
function taskExists(sessionId, taskId) {
    const sessionDir = (0, session_utils_1.getSessionDir)(sessionId);
    const taskFile = path.join(sessionDir, 'tasks', `${taskId}.json`);
    return fs.existsSync(taskFile);
}
// ============================================================================
// Status Detection
// ============================================================================
/**
 * Parse agent output to determine completion status
 */
function determineStatus(output) {
    const lowerOutput = output.toLowerCase();
    if (lowerOutput.includes('task failed') ||
        lowerOutput.includes('failed') ||
        lowerOutput.includes('error')) {
        // Extract failure reason (first 3 lines with fail/error)
        const lines = output.split('\n');
        const errorLines = lines
            .filter((line) => line.toLowerCase().includes('fail') ||
            line.toLowerCase().includes('error'))
            .slice(0, 3);
        return {
            status: 'failed',
            failureReason: errorLines.join(' ').trim(),
        };
    }
    return {
        status: 'completed',
        failureReason: '',
    };
}
/**
 * Extract task ID from agent output if not provided
 */
function extractTaskId(output) {
    const match = output.match(/Task.*?:\s*([A-Z]-\d+)/);
    return match ? match[1] : '';
}
// ============================================================================
// Main Hook Logic
// ============================================================================
async function main() {
    try {
        // Read stdin JSON
        const input = await readStdin();
        const hookInput = JSON.parse(input);
        // Parse hook input fields
        const agentId = hookInput.agent_id || '';
        const agentOutput = hookInput.output || '';
        let taskId = hookInput.task_id || '';
        // Get session ID from input
        const sessionId = hookInput.session_id;
        // No active ultrawork session - not an ultrawork worker
        if (!sessionId) {
            outputResponse();
            return;
        }
        // Check if session file exists
        const sessionFile = (0, session_utils_1.getSessionFile)(sessionId);
        if (!fs.existsSync(sessionFile)) {
            outputResponse();
            return;
        }
        // Read session
        const content = fs.readFileSync(sessionFile, 'utf-8');
        const session = JSON.parse(content);
        // Check if this agent is tracked as an ultrawork worker
        const isWorker = isTrackedWorker(session, agentId);
        if (!isWorker) {
            // Check if this task_id exists in our session
            if (taskId) {
                if (!taskExists(sessionId, taskId)) {
                    outputResponse();
                    return; // Not an ultrawork worker
                }
            }
            else {
                outputResponse();
                return; // No task_id and not in workers array
            }
        }
        // Parse worker output for status
        const { status, failureReason } = determineStatus(agentOutput);
        // Extract task ID if not provided
        if (!taskId && isWorker) {
            const workers = session.workers || [];
            const worker = workers.find((w) => w.agent_id === agentId);
            if (worker) {
                taskId = worker.task_id;
            }
        }
        if (!taskId) {
            // Try to extract from agent output
            taskId = extractTaskId(agentOutput);
        }
        // Timestamp
        const timestamp = new Date().toISOString();
        // Update worker status and task status in session
        if (taskId) {
            try {
                await (0, session_utils_1.updateSession)(sessionId, (s) => {
                    const sessionWithWorkers = s;
                    const workers = sessionWithWorkers.workers || [];
                    // Update or add worker entry
                    const workerIndex = workers.findIndex((w) => w.agent_id === agentId);
                    if (workerIndex >= 0) {
                        // Update existing worker
                        workers[workerIndex] = {
                            ...workers[workerIndex],
                            status,
                            completed_at: timestamp,
                            ...(failureReason && { failure_reason: failureReason }),
                        };
                    }
                    else {
                        // Add new worker entry
                        workers.push({
                            agent_id: agentId,
                            task_id: taskId,
                            started_at: timestamp,
                            completed_at: timestamp,
                            status,
                        });
                    }
                    // Add evidence log entry
                    const outputLines = agentOutput.split('\n');
                    const summary = outputLines.slice(0, 3).join(' ');
                    const evidence = {
                        type: 'agent_completed',
                        timestamp,
                        agent_id: agentId,
                        task_id: taskId,
                    };
                    // Add custom fields
                    const completedEvidence = {
                        ...evidence,
                        status,
                        summary,
                    };
                    return {
                        ...sessionWithWorkers,
                        workers,
                        evidence_log: [...s.evidence_log, completedEvidence],
                    };
                });
                // Log completion for debugging
                console.error(`Agent ${agentId} completed (task: ${taskId}, status: ${status})`);
            }
            catch (err) {
                console.error(`Failed to update session for agent ${agentId}:`, err);
            }
        }
        // Output response
        outputResponse();
    }
    catch {
        // Even on error, output response and exit 0
        outputResponse();
    }
}
// ============================================================================
// Entry Point
// ============================================================================
// Handle stdin
if (process.stdin.isTTY) {
    // No stdin available, output response
    outputResponse();
    process.exit(0);
}
else {
    // Read stdin and process
    process.stdin.setEncoding('utf8');
    main()
        .then(() => process.exit(0))
        .catch(() => {
        // On error, output response and exit 0
        outputResponse();
        process.exit(0);
    });
}
//# sourceMappingURL=subagent-stop-tracking.js.map