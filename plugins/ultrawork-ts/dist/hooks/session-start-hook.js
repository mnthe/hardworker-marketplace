#!/usr/bin/env node
"use strict";
/**
 * SessionStart Hook - Cleanup old ultrawork sessions and provide session ID
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
const os = __importStar(require("os"));
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
 * Cleanup old sessions (completed/cancelled/failed older than 7 days)
 */
function cleanupOldSessions() {
    const sessionsDir = path.join(os.homedir(), '.claude', 'ultrawork', 'sessions');
    if (!fs.existsSync(sessionsDir)) {
        return;
    }
    try {
        const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
        const sessionDirs = entries.filter(e => e.isDirectory());
        // Only cleanup if there are more than 10 sessions
        if (sessionDirs.length <= 10) {
            return;
        }
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        for (const entry of sessionDirs) {
            const sessionPath = path.join(sessionsDir, entry.name);
            const sessionJsonPath = path.join(sessionPath, 'session.json');
            if (!fs.existsSync(sessionJsonPath)) {
                continue;
            }
            // Check if directory is older than 7 days
            const stats = fs.statSync(sessionPath);
            if (stats.mtimeMs > sevenDaysAgo) {
                continue;
            }
            // Check if session is in terminal state
            try {
                const sessionData = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
                const phase = sessionData.phase || '';
                if (phase === 'COMPLETE' || phase === 'CANCELLED' || phase === 'FAILED') {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }
            }
            catch (err) {
                // Ignore parse errors, just skip this session
                continue;
            }
        }
    }
    catch (err) {
        // Silently ignore cleanup errors
    }
}
/**
 * Main hook logic
 */
async function main() {
    try {
        // Read stdin JSON
        const input = await readStdin();
        const hookInput = JSON.parse(input);
        // Extract session_id
        const sessionId = hookInput.session_id;
        // Cleanup old sessions
        cleanupOldSessions();
        // Output session ID for AI to use
        const output = {
            hookSpecificOutput: {
                hookEventName: 'SessionStart'
            }
        };
        if (sessionId) {
            output.hookSpecificOutput.additionalContext =
                `═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION ID (USE THIS VALUE DIRECTLY)
═══════════════════════════════════════════════════════════
 CLAUDE_SESSION_ID: ${sessionId}

 When calling ultrawork scripts, use the EXACT value above:
 --session ${sessionId}

 DO NOT use placeholders like {SESSION_ID} or $SESSION_ID
═══════════════════════════════════════════════════════════`;
        }
        console.log(JSON.stringify(output));
        process.exit(0);
    }
    catch (err) {
        // Even on error, output minimal valid JSON and exit 0
        console.log(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'SessionStart'
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
            hookEventName: 'SessionStart'
        }
    }));
    process.exit(0);
}
else {
    // Read stdin and process
    process.stdin.setEncoding('utf8');
    main().catch(() => {
        // On error, output minimal valid JSON and exit 0
        console.log(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'SessionStart'
            }
        }));
        process.exit(0);
    });
}
//# sourceMappingURL=session-start-hook.js.map