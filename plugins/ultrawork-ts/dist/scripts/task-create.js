#!/usr/bin/env node
"use strict";
/**
 * task-create.ts - Create new task JSON file
 * CLI to create task files with validation
 *
 * Usage: task-create.ts --session <ID> --id <id> --subject "..." [options]
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
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--session':
                args.session = argv[++i];
                break;
            case '--id':
                args.id = argv[++i];
                break;
            case '--subject':
                args.subject = argv[++i];
                break;
            case '--description':
                args.description = argv[++i];
                break;
            case '--complexity':
                args.complexity = argv[++i];
                break;
            case '--criteria':
                args.criteria = argv[++i];
                break;
            case '--blocked-by':
                args.blockedBy = argv[++i];
                break;
            case '-h':
            case '--help':
                console.log('Usage: task-create.ts --session <ID> --id <id> --subject "..." [options]');
                console.log('Options:');
                console.log('  --description "..."       Task description (defaults to subject)');
                console.log('  --complexity simple|standard|complex  (default: standard)');
                console.log('  --criteria "..."          Pipe-separated criteria');
                console.log('  --blocked-by "1,2"        Comma-separated task IDs');
                process.exit(0);
                break;
        }
    }
    return args;
}
// ============================================================================
// Validation
// ============================================================================
function validateArgs(args) {
    if (!args.session) {
        console.error('Error: --session required');
        process.exit(1);
    }
    if (!args.id) {
        console.error('Error: --id required');
        process.exit(1);
    }
    if (!args.subject) {
        console.error('Error: --subject required');
        process.exit(1);
    }
    // Validate complexity if provided
    if (args.complexity) {
        const validComplexities = ['simple', 'standard', 'complex'];
        if (!validComplexities.includes(args.complexity)) {
            console.error(`Error: Invalid complexity "${args.complexity}". Must be: simple, standard, or complex`);
            process.exit(1);
        }
    }
}
// ============================================================================
// Task Creation
// ============================================================================
function parseCriteria(criteriaStr) {
    if (!criteriaStr || criteriaStr.trim() === '') {
        return [];
    }
    return criteriaStr
        .split('|')
        .map(c => c.trim())
        .filter(c => c.length > 0);
}
function parseBlockedBy(blockedByStr) {
    if (!blockedByStr || blockedByStr.trim() === '') {
        return [];
    }
    return blockedByStr
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
}
function createTask(args) {
    const sessionDir = (0, session_utils_1.getSessionDir)(args.session);
    const tasksDir = path.join(sessionDir, 'tasks');
    const taskFile = path.join(tasksDir, `${args.id}.json`);
    // Create tasks directory if needed
    if (!fs.existsSync(tasksDir)) {
        fs.mkdirSync(tasksDir, { recursive: true });
    }
    // Check if task already exists
    if (fs.existsSync(taskFile)) {
        console.error(`Error: Task ${args.id} already exists`);
        process.exit(1);
    }
    // Build task object
    const now = new Date().toISOString();
    const task = {
        id: args.id,
        subject: args.subject,
        description: args.description || args.subject,
        complexity: args.complexity || 'standard',
        status: 'open',
        blocked_by: parseBlockedBy(args.blockedBy || ''),
        criteria: parseCriteria(args.criteria || ''),
        evidence: [],
        created_at: now,
        updated_at: now
    };
    // Write task JSON
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2), 'utf-8');
    // Output success message and task JSON
    console.log(`OK: Task ${args.id} created`);
    console.log(JSON.stringify(task, null, 2));
}
// ============================================================================
// Main
// ============================================================================
function main() {
    try {
        const args = parseArgs(process.argv.slice(2));
        validateArgs(args);
        createTask(args);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        }
        else {
            console.error('Error: Unknown error occurred');
        }
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=task-create.js.map