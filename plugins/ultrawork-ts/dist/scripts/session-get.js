#!/usr/bin/env node
"use strict";
/**
 * session-get.ts - Get session info
 * Usage: session-get.ts --session <ID> [--field phase|goal|options] [--dir] [--file]
 * TypeScript port of session-get.sh
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
exports.parseArgs = parseArgs;
exports.getFieldValue = getFieldValue;
const fs = __importStar(require("fs"));
const session_utils_1 = require("../lib/session-utils");
function parseArgs(argv) {
    const args = {
        getDir: false,
        getFile: false,
        help: false,
    };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--session':
                args.sessionId = argv[++i];
                break;
            case '--field':
                args.field = argv[++i];
                break;
            case '--dir':
                args.getDir = true;
                break;
            case '--file':
                args.getFile = true;
                break;
            case '-h':
            case '--help':
                args.help = true;
                break;
        }
    }
    return args;
}
function showHelp() {
    console.log('Usage: session-get.ts --session <ID> [--field phase|goal|options] [--dir] [--file]');
    console.log('');
    console.log('Options:');
    console.log('  --session <ID>   Session ID (required)');
    console.log('  --field <name>   Get specific field from session.json');
    console.log('  --dir            Return session directory path');
    console.log('  --file           Return session.json file path');
}
// ============================================================================
// Main Logic
// ============================================================================
function getFieldValue(obj, fieldPath) {
    const parts = fieldPath.split('.');
    let value = obj;
    for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        }
        else {
            return null;
        }
    }
    return value;
}
function main() {
    const args = parseArgs(process.argv);
    // Show help
    if (args.help) {
        showHelp();
        process.exit(0);
    }
    // Validate session ID
    if (!args.sessionId) {
        console.error('Error: --session <ID> required');
        process.exit(1);
    }
    // Return session directory path
    if (args.getDir) {
        const dir = (0, session_utils_1.getSessionDir)(args.sessionId);
        console.log(dir);
        process.exit(0);
    }
    // Return session file path
    if (args.getFile) {
        const file = (0, session_utils_1.getSessionFile)(args.sessionId);
        console.log(file);
        process.exit(0);
    }
    // Resolve session ID to file path (validates existence)
    try {
        const sessionFile = (0, session_utils_1.resolveSessionId)(args.sessionId);
        // Get specific field or entire session
        if (args.field) {
            const session = (0, session_utils_1.readSession)(args.sessionId);
            const value = getFieldValue(session, args.field);
            if (value === null || value === undefined) {
                console.error(`Error: Field '${args.field}' not found in session`);
                process.exit(1);
            }
            // Output value (JSON if object, raw if primitive)
            if (typeof value === 'object') {
                console.log(JSON.stringify(value, null, 2));
            }
            else {
                console.log(value);
            }
        }
        else {
            // Output entire session.json
            const content = fs.readFileSync(sessionFile, 'utf-8');
            console.log(content);
        }
        process.exit(0);
    }
    catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=session-get.js.map