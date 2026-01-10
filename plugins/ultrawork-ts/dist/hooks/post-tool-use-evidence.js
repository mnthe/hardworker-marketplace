#!/usr/bin/env node
"use strict";
/**
 * Ultrawork PostToolUse Evidence Hook
 * Automatically captures evidence from tool executions
 * TypeScript/Node.js port of post-tool-use-evidence.sh
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
// Utility Functions
// ============================================================================
/**
 * Truncate large outputs to first 5K + last 5K if > 10K chars
 */
function truncateOutput(text, maxLen = 10000) {
    if (text.length <= maxLen) {
        return text;
    }
    const firstChunk = text.slice(0, 5000);
    const lastChunk = text.slice(-5000);
    const truncated = text.length - 10000;
    return `${firstChunk}\n... [truncated ${truncated} bytes] ...\n${lastChunk}`;
}
/**
 * Detect if command is a test command
 */
function isTestCommand(cmd) {
    const testPatterns = [
        /(npm|yarn|pnpm)\s+(run\s+)?test/,
        /pytest/,
        /cargo\s+test/,
        /go\s+test/,
        /jest/,
        /vitest/,
        /phpunit/,
        /ruby\s+.*test/,
        /python.*test/,
    ];
    return testPatterns.some(pattern => pattern.test(cmd));
}
/**
 * Parse test output and extract summary
 */
function parseTestOutput(output) {
    // npm/jest/vitest pattern
    const npmMatch = output.match(/Tests:.*passed/);
    if (npmMatch) {
        return npmMatch[0].trim();
    }
    // pytest pattern
    const pytestMatch = output.match(/passed.*failed/);
    if (pytestMatch) {
        return pytestMatch[0].trim();
    }
    // cargo test pattern
    const cargoMatch = output.match(/test result:.*/);
    if (cargoMatch) {
        return cargoMatch[0].trim();
    }
    // go test pattern
    const goMatch = output.match(/^(PASS|FAIL).*/m);
    if (goMatch) {
        return goMatch[0].trim();
    }
    // No pattern matched - return truncated output
    return truncateOutput(output, 1000);
}
/**
 * Convert tool response to string
 */
function toolResponseToString(response) {
    if (typeof response === 'string') {
        return response;
    }
    if (typeof response === 'object' && response !== null) {
        return JSON.stringify(response);
    }
    return '';
}
// ============================================================================
// Evidence Builders
// ============================================================================
/**
 * Build bash tool evidence (command_execution or test_result)
 */
function buildBashEvidence(command, output, exitCode) {
    const timestamp = new Date().toISOString();
    if (isTestCommand(command)) {
        // Test result evidence
        const summary = parseTestOutput(output);
        const passed = exitCode === 0;
        // Detect framework
        let framework = 'unknown';
        if (/npm|jest/.test(command))
            framework = 'jest';
        else if (/pytest/.test(command))
            framework = 'pytest';
        else if (/cargo/.test(command))
            framework = 'cargo';
        else if (/go test/.test(command))
            framework = 'go';
        else if (/vitest/.test(command))
            framework = 'vitest';
        const evidence = {
            type: 'test_result',
            timestamp,
            passed,
            framework,
            output_preview: summary,
        };
        return evidence;
    }
    else {
        // Command execution evidence
        const preview = truncateOutput(output, 1000);
        const evidence = {
            type: 'command_execution',
            timestamp,
            command,
            exit_code: exitCode,
            output_preview: preview,
        };
        return evidence;
    }
}
/**
 * Build file operation evidence (read/write/edit)
 */
function buildFileEvidence(operation, filePath) {
    const timestamp = new Date().toISOString();
    const evidence = {
        type: 'file_operation',
        timestamp,
        operation,
        path: filePath,
    };
    return evidence;
}
// ============================================================================
// Main Hook Logic
// ============================================================================
async function main() {
    try {
        // Read stdin
        const stdinBuffer = [];
        for await (const chunk of process.stdin) {
            stdinBuffer.push(chunk);
        }
        const stdinContent = Buffer.concat(stdinBuffer).toString('utf-8');
        // Parse hook input
        let hookInput;
        try {
            hookInput = JSON.parse(stdinContent);
        }
        catch {
            // Invalid JSON - exit silently
            console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
            process.exit(0);
        }
        // Extract session_id
        const sessionId = hookInput.session_id;
        if (!sessionId) {
            // No session - exit silently
            console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
            process.exit(0);
        }
        // Set environment variable for session-utils
        process.env.ULTRAWORK_STDIN_SESSION_ID = sessionId;
        // Check if session exists
        const sessionFile = (0, session_utils_1.getSessionFile)(sessionId);
        if (!fs.existsSync(sessionFile)) {
            // Session doesn't exist - exit silently
            console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
            process.exit(0);
        }
        // Read session to check phase
        const session = (0, session_utils_1.readSession)(sessionId);
        const phase = session.phase || 'unknown';
        // Only capture evidence during EXECUTION and VERIFICATION phases
        const activePhases = ['EXECUTION', 'VERIFICATION'];
        if (!activePhases.includes(phase)) {
            console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
            process.exit(0);
        }
        // Extract tool_name
        const toolName = hookInput.tool_name;
        if (!toolName) {
            // No tool name - exit silently
            console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
            process.exit(0);
        }
        // Process based on tool type
        let evidence = null;
        const toolNameLower = toolName.toLowerCase();
        switch (toolNameLower) {
            case 'bash': {
                // Extract command and output
                const command = hookInput.tool_input?.command;
                if (!command)
                    break;
                const response = toolResponseToString(hookInput.tool_response);
                const exitCode = hookInput.tool_response &&
                    typeof hookInput.tool_response === 'object'
                    ? hookInput.tool_response.exit_code ?? 0
                    : 0;
                evidence = buildBashEvidence(command, response, exitCode);
                break;
            }
            case 'read': {
                // Extract file path
                const filePath = hookInput.tool_input?.file_path;
                if (!filePath)
                    break;
                evidence = buildFileEvidence('read', filePath);
                break;
            }
            case 'write': {
                // Extract file path
                const filePath = hookInput.tool_input?.file_path;
                if (!filePath)
                    break;
                evidence = buildFileEvidence('write', filePath);
                break;
            }
            case 'edit': {
                // Extract file path
                const filePath = hookInput.tool_input?.file_path;
                if (!filePath)
                    break;
                evidence = buildFileEvidence('edit', filePath);
                break;
            }
            default:
                // Unknown tool - exit silently
                break;
        }
        // If we have evidence, append it to session
        if (evidence) {
            await (0, session_utils_1.updateSession)(sessionId, (session) => {
                // Ensure evidence_log exists
                if (!session.evidence_log) {
                    session.evidence_log = [];
                }
                // Append evidence
                session.evidence_log.push(evidence);
                return session;
            });
        }
        // Output required hook response
        console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
        process.exit(0);
    }
    catch (error) {
        // Log error but still exit 0 (hooks should never fail the tool)
        console.error('Evidence hook error:', error);
        console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
        process.exit(0);
    }
}
// Run main
main();
//# sourceMappingURL=post-tool-use-evidence.js.map