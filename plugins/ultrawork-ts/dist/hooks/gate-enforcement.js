#!/usr/bin/env node
"use strict";
/**
 * Gate Enforcement Hook (PreToolUse)
 * Blocks Edit/Write during PLANNING phase (except design.md, session files)
 * v1.0: TypeScript port from bash version
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
 * Check if file is allowed during PLANNING phase
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
    if (filePath.includes('design.md')) {
        return true;
    }
    if (filePath.includes('session.json')) {
        return true;
    }
    if (filePath.includes('context.json')) {
        return true;
    }
    if (filePath.includes('/exploration/')) {
        return true;
    }
    if (filePath.includes('/.claude/ultrawork/')) {
        return true;
    }
    return false;
}
/**
 * Create denial response with detailed reason
 */
function createDenialResponse(tool, filePath) {
    const reason = `⛔ GATE VIOLATION: ${tool} blocked in PLANNING phase.

Current Phase: PLANNING
Blocked Tool: ${tool}
Target File: ${filePath}

Direct file modifications are prohibited during PLANNING phase.

Correct procedure:
1. Write design.md (Write allowed)
2. Create tasks with task-create.sh
3. Get user approval
4. Transition to EXECUTION phase
5. Worker agent performs actual work

Allowed files:
- design.md (planning document)
- session.json, context.json (session state)
- exploration/*.md (exploration results)`;
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
 */
function createAllowResponse() {
    return {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow'
        }
    };
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
        // Only process Edit and Write tools
        if (toolName !== 'Edit' && toolName !== 'Write') {
            console.log(JSON.stringify(createAllowResponse()));
            process.exit(0);
            return;
        }
        // Extract session ID
        const sessionId = hookInput.session_id;
        // No session - allow
        if (!sessionId) {
            console.log(JSON.stringify(createAllowResponse()));
            process.exit(0);
            return;
        }
        // Check if session is active
        if (!(0, session_utils_1.isSessionActive)(sessionId)) {
            console.log(JSON.stringify(createAllowResponse()));
            process.exit(0);
            return;
        }
        // Get session data
        let session;
        try {
            session = (0, session_utils_1.readSession)(sessionId);
        }
        catch {
            // Session file error - allow
            console.log(JSON.stringify(createAllowResponse()));
            process.exit(0);
            return;
        }
        // Only enforce during PLANNING phase
        if (session.phase !== 'PLANNING') {
            console.log(JSON.stringify(createAllowResponse()));
            process.exit(0);
            return;
        }
        // Get file path from tool input
        const filePath = hookInput.tool_input?.file_path || '';
        // Check if file is allowed
        if (isFileAllowed(filePath)) {
            console.log(JSON.stringify(createAllowResponse()));
            process.exit(0);
            return;
        }
        // Block with clear message
        console.log(JSON.stringify(createDenialResponse(toolName, filePath)));
        process.exit(0);
    }
    catch (err) {
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
}
else {
    // Read stdin and process
    process.stdin.setEncoding('utf8');
    main().catch(() => {
        // On error, allow (fail open)
        console.log(JSON.stringify(createAllowResponse()));
        process.exit(0);
    });
}
//# sourceMappingURL=gate-enforcement.js.map