#!/usr/bin/env node
"use strict";
/**
 * Ultrawork Cancel Script
 * Sets phase to CANCELLED, cancelled_at to current timestamp
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
// Argument Parsing
// ============================================================================
function parseArgs() {
    const args = process.argv.slice(2);
    let sessionId;
    let help = false;
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '-h':
            case '--help':
                help = true;
                break;
            case '--session':
                if (i + 1 < args.length) {
                    sessionId = args[i + 1];
                    i++; // Skip next argument
                }
                else {
                    console.error('❌ Error: --session requires a session ID argument');
                    process.exit(1);
                }
                break;
        }
    }
    return { sessionId, help };
}
// ============================================================================
// Help Text
// ============================================================================
function showHelp() {
    console.log(`
═══════════════════════════════════════════════════════════
 ULTRAWORK-CANCEL - Cancel Session
═══════════════════════════════════════════════════════════

USAGE:
  ultrawork-cancel --session <id>

OPTIONS:
  --session <id>   Session ID (required, provided by AI)
  -h, --help       Show this help message

═══════════════════════════════════════════════════════════
`);
}
// ============================================================================
// Cancel Session
// ============================================================================
async function cancelSession(sessionId) {
    const sessionFile = (0, session_utils_1.getSessionFile)(sessionId);
    if (!fs.existsSync(sessionFile)) {
        console.error(`❌ Session ${sessionId} not found.`);
        process.exit(1);
    }
    let session;
    try {
        session = (0, session_utils_1.readSession)(sessionId);
    }
    catch (error) {
        console.error(`❌ Failed to read session: ${error}`);
        process.exit(1);
    }
    // Check if already cancelled
    if (session.cancelled_at && session.cancelled_at !== null) {
        console.log(`Session ${sessionId} already cancelled at ${session.cancelled_at}`);
        process.exit(0);
    }
    const timestamp = new Date().toISOString();
    // Update session
    try {
        await (0, session_utils_1.updateSession)(sessionId, (s) => ({
            ...s,
            phase: 'CANCELLED',
            cancelled_at: timestamp,
            updated_at: timestamp,
        }));
    }
    catch (error) {
        console.error(`❌ Failed to update session: ${error}`);
        process.exit(1);
    }
    // Output cancellation message
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' ULTRAWORK SESSION CANCELLED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(` Session ID: ${session.session_id}`);
    console.log(` Goal: ${session.goal}`);
    console.log(` Started: ${session.started_at}`);
    console.log(` Cancelled: ${timestamp}`);
    console.log('');
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
    console.log(' Session history preserved in:');
    console.log(` ${sessionFile}`);
    console.log('');
    console.log(' Start a new session with:');
    console.log(' /ultrawork "your new goal"');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
}
// ============================================================================
// Main
// ============================================================================
async function main() {
    const { sessionId, help } = parseArgs();
    if (help) {
        showHelp();
        process.exit(0);
    }
    if (!sessionId) {
        console.error('❌ Error: --session is required');
        process.exit(1);
    }
    await cancelSession(sessionId);
}
main().catch((error) => {
    console.error(`❌ Unexpected error: ${error}`);
    process.exit(1);
});
//# sourceMappingURL=ultrawork-cancel.js.map