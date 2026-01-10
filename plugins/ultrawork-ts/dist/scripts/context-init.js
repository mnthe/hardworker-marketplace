#!/usr/bin/env node
"use strict";
/**
 * context-init.ts - Initialize context.json with expected explorers
 * Usage: context-init.ts --session <ID> --expected "overview,exp-1,exp-2,exp-3"
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
// Argument Parsing
// ============================================================================
function parseArgs() {
    const args = process.argv.slice(2);
    let sessionId = '';
    let expected = '';
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--session':
                sessionId = args[++i] || '';
                break;
            case '--expected':
                expected = args[++i] || '';
                break;
            case '-h':
            case '--help':
                console.log('Usage: context-init.ts --session <ID> --expected "overview,exp-1,exp-2"');
                console.log('');
                console.log('Initializes context.json with expected explorer IDs.');
                console.log('exploration_complete will be set to true when all expected explorers are added.');
                process.exit(0);
        }
    }
    if (!sessionId || !expected) {
        console.error('Error: --session and --expected required');
        process.exit(1);
    }
    return { sessionId, expected };
}
// ============================================================================
// Main Logic
// ============================================================================
function main() {
    const { sessionId, expected } = parseArgs();
    try {
        // Get session directory
        const sessionDir = (0, session_utils_1.getSessionDir)(sessionId);
        const contextFile = path.join(sessionDir, 'context.json');
        // Parse expected explorers from comma-separated string
        const expectedExplorers = expected
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0);
        // Check if context.json exists
        if (fs.existsSync(contextFile)) {
            // Update existing context.json
            const content = fs.readFileSync(contextFile, 'utf-8');
            const context = JSON.parse(content);
            context.expected_explorers = expectedExplorers;
            context.exploration_complete = false;
            fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
        }
        else {
            // Create new context.json
            const newContext = {
                version: '2.1',
                expected_explorers: expectedExplorers,
                exploration_complete: false,
                explorers: [],
                key_files: [],
                patterns: [],
                constraints: [],
            };
            fs.writeFileSync(contextFile, JSON.stringify(newContext, null, 2), 'utf-8');
        }
        console.log('OK: context.json initialized');
        console.log(`    Expected explorers: ${expected}`);
        process.exit(0);
    }
    catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
// ============================================================================
// Entry Point
// ============================================================================
if (require.main === module) {
    main();
}
//# sourceMappingURL=context-init.js.map