#!/usr/bin/env node
"use strict";
/**
 * Ultrawork Evidence Script
 * Lists evidence_log entries with formatting
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
 ULTRAWORK-EVIDENCE - View Collected Evidence
═══════════════════════════════════════════════════════════

USAGE:
  ultrawork-evidence --session <id>

OPTIONS:
  --session <id>   Session ID (required, provided by AI)
  -h, --help       Show this help message

═══════════════════════════════════════════════════════════
`);
}
// ============================================================================
// Format Evidence Entry
// ============================================================================
function formatEvidenceEntry(entry, index) {
    const lines = [];
    lines.push(`[${index + 1}] ${entry.type.toUpperCase()}`);
    lines.push(`    Timestamp: ${entry.timestamp}`);
    switch (entry.type) {
        case 'command_execution':
            lines.push(`    Command: ${entry.command}`);
            lines.push(`    Exit Code: ${entry.exit_code}`);
            if (entry.output_preview) {
                lines.push(`    Output: ${entry.output_preview.substring(0, 100)}...`);
            }
            break;
        case 'file_operation':
            lines.push(`    Operation: ${entry.operation}`);
            lines.push(`    Path: ${entry.path}`);
            break;
        case 'agent_completed':
            lines.push(`    Agent ID: ${entry.agent_id}`);
            if (entry.task_id) {
                lines.push(`    Task ID: ${entry.task_id}`);
            }
            break;
        case 'test_result':
            lines.push(`    Passed: ${entry.passed}`);
            lines.push(`    Framework: ${entry.framework}`);
            if (entry.output_preview) {
                lines.push(`    Output: ${entry.output_preview.substring(0, 100)}...`);
            }
            break;
        default:
            lines.push(`    Data: ${JSON.stringify(entry)}`);
    }
    return lines.join('\n');
}
// ============================================================================
// Show Evidence Log
// ============================================================================
function showEvidenceLog(sessionId) {
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
    const sessionDir = (0, session_utils_1.getSessionDir)(sessionId);
    // Output header
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' ULTRAWORK EVIDENCE LOG');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(` Session ID: ${session.session_id}`);
    console.log(` Goal: ${session.goal}`);
    console.log(` Phase: ${session.phase}`);
    console.log('');
    console.log('───────────────────────────────────────────────────────────');
    console.log(' EVIDENCE');
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
    // Display evidence_log entries
    if (!session.evidence_log || session.evidence_log.length === 0) {
        console.log('  (no evidence collected yet)');
    }
    else {
        session.evidence_log.forEach((entry, index) => {
            console.log(formatEvidenceEntry(entry, index));
            console.log('');
        });
        console.log('───────────────────────────────────────────────────────────');
        console.log(` Total Evidence Items: ${session.evidence_log.length}`);
    }
    console.log('');
    console.log('───────────────────────────────────────────────────────────');
    console.log(' SESSION DIRECTORY');
    console.log('───────────────────────────────────────────────────────────');
    console.log('');
    console.log(` ${sessionDir}/`);
    console.log('   ├── session.json');
    console.log('   ├── context.json');
    console.log('   ├── exploration/');
    console.log('   └── tasks/');
    console.log('');
    console.log(' To view full session data:');
    console.log(`   cat "${sessionFile}" | jq '.'`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
}
// ============================================================================
// Main
// ============================================================================
function main() {
    const { sessionId, help } = parseArgs();
    if (help) {
        showHelp();
        process.exit(0);
    }
    if (!sessionId) {
        console.error('❌ Error: --session is required');
        process.exit(1);
    }
    showEvidenceLog(sessionId);
}
main();
//# sourceMappingURL=ultrawork-evidence.js.map