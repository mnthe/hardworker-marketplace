#!/usr/bin/env node
"use strict";
/**
 * context-add.ts - Add explorer summary to context.json
 * Usage: context-add.ts --session <ID> --explorer-id <id> --hint "..." --file "exploration/exp-1.md" --summary "..." --key-files "f1,f2" --patterns "p1,p2"
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
function parseArgs() {
    const args = process.argv.slice(2);
    let sessionId = '';
    let explorerId = '';
    let hint = '';
    let file = '';
    let summary = '';
    let keyFiles = '';
    let patterns = '';
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--session':
                sessionId = args[++i] || '';
                break;
            case '--explorer-id':
                explorerId = args[++i] || '';
                break;
            case '--hint':
                hint = args[++i] || '';
                break;
            case '--file':
                file = args[++i] || '';
                break;
            case '--summary':
                summary = args[++i] || '';
                break;
            case '--key-files':
                keyFiles = args[++i] || '';
                break;
            case '--patterns':
                patterns = args[++i] || '';
                break;
            case '-h':
            case '--help':
                console.log('Usage: context-add.ts --session <ID> --explorer-id <id> --hint "..." --file "exploration/exp-1.md" --summary "..." --key-files "f1,f2" --patterns "p1,p2"');
                console.log('');
                console.log('Adds a lightweight explorer entry to context.json with link to detailed markdown.');
                process.exit(0);
        }
    }
    if (!sessionId || !explorerId) {
        console.error('Error: --session and --explorer-id required');
        process.exit(1);
    }
    return { sessionId, explorerId, hint, file, summary, keyFiles, patterns };
}
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Parse comma-separated string into array, filtering empty strings
 */
function parseCommaSeparated(input) {
    if (!input) {
        return [];
    }
    return input
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}
/**
 * Merge arrays and remove duplicates
 */
function mergeUnique(arr1, arr2) {
    return Array.from(new Set([...arr1, ...arr2]));
}
/**
 * Check if two sorted arrays are equal
 */
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
}
// ============================================================================
// Main Logic
// ============================================================================
function main() {
    const { sessionId, explorerId, hint, file, summary, keyFiles, patterns } = parseArgs();
    try {
        // Get session directory
        const sessionDir = (0, session_utils_1.getSessionDir)(sessionId);
        const contextFile = path.join(sessionDir, 'context.json');
        // Initialize context.json if it doesn't exist
        if (!fs.existsSync(contextFile)) {
            const initialContext = {
                version: '2.1',
                expected_explorers: [],
                exploration_complete: false,
                explorers: [],
                key_files: [],
                patterns: [],
                constraints: [],
            };
            fs.writeFileSync(contextFile, JSON.stringify(initialContext, null, 2), 'utf-8');
        }
        // Read current context
        const content = fs.readFileSync(contextFile, 'utf-8');
        const context = JSON.parse(content);
        // Check if explorer already exists (avoid duplicates)
        const existingExplorer = context.explorers.find((exp) => exp.id === explorerId);
        if (existingExplorer) {
            console.log(`Warning: Explorer ${explorerId} already exists, skipping`);
            process.exit(0);
        }
        // Parse key files and patterns
        const newKeyFiles = parseCommaSeparated(keyFiles);
        const newPatterns = parseCommaSeparated(patterns);
        // Build new explorer entry (lightweight - just summary and link)
        const newExplorer = {
            id: explorerId,
            hint: hint || '',
            file: file || '',
            summary: summary || '',
        };
        // Add explorer to context
        context.explorers.push(newExplorer);
        // Merge and deduplicate key_files
        context.key_files = mergeUnique(context.key_files || [], newKeyFiles);
        // Merge and deduplicate patterns
        context.patterns = mergeUnique(context.patterns || [], newPatterns);
        // Check if all expected explorers are complete
        if (context.expected_explorers && context.expected_explorers.length > 0) {
            const actualIds = context.explorers.map((exp) => exp.id);
            if (arraysEqual(context.expected_explorers, actualIds)) {
                context.exploration_complete = true;
                fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
                console.log('OK: All expected explorers complete. exploration_complete=true');
            }
            else {
                fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
            }
        }
        else {
            fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
        }
        console.log(`OK: Explorer ${explorerId} added to context.json`);
        console.log(`    File: ${file}`);
        console.log(`    Summary: ${summary.substring(0, 50)}...`);
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
//# sourceMappingURL=context-add.js.map