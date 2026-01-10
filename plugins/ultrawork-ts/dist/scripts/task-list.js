#!/usr/bin/env node
"use strict";
/**
 * task-list.ts - List tasks with filtering
 * Usage: task-list.ts --session <ID> [--status open|resolved] [--format json|table]
 *
 * TypeScript port of task-list.sh
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
exports.collectTasks = collectTasks;
exports.outputJson = outputJson;
exports.outputTable = outputTable;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const session_utils_1 = require("../lib/session-utils");
function parseArgs(argv) {
    const args = {
        format: 'table',
        help: false,
    };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--session':
                args.session = argv[++i];
                break;
            case '--status':
                args.status = argv[++i];
                break;
            case '--format':
                args.format = argv[++i];
                break;
            case '-h':
            case '--help':
                args.help = true;
                break;
            default:
                // Skip unknown args
                break;
        }
    }
    return args;
}
function collectTasks(tasksDir, statusFilter) {
    if (!fs.existsSync(tasksDir)) {
        throw new Error('No tasks directory found');
    }
    const tasks = [];
    const files = fs.readdirSync(tasksDir);
    for (const file of files) {
        if (!file.endsWith('.json')) {
            continue;
        }
        const taskFile = path.join(tasksDir, file);
        const id = path.basename(file, '.json');
        try {
            const content = fs.readFileSync(taskFile, 'utf-8');
            const taskData = JSON.parse(content);
            const status = taskData.status || 'open';
            const subject = taskData.subject || 'Unknown';
            const blocked_by = (taskData.blockedBy || []).join(',');
            const complexity = taskData.complexity || 'standard';
            // Apply status filter
            if (statusFilter && status !== statusFilter) {
                continue;
            }
            tasks.push({
                id,
                status,
                subject,
                blocked_by,
                complexity,
            });
        }
        catch (err) {
            // Skip invalid task files
            console.error(`Warning: Failed to parse ${file}: ${err}`, { file: process.stderr });
            continue;
        }
    }
    return tasks;
}
// ============================================================================
// Output Formatting
// ============================================================================
function outputJson(tasks) {
    const output = tasks.map((t) => ({
        id: t.id,
        status: t.status,
        subject: t.subject,
        blockedBy: t.blocked_by,
        complexity: t.complexity,
    }));
    console.log(JSON.stringify(output, null, 2));
}
function outputTable(tasks) {
    console.log('ID|STATUS|SUBJECT|BLOCKED_BY|COMPLEXITY');
    for (const task of tasks) {
        console.log(`${task.id}|${task.status}|${task.subject}|${task.blocked_by}|${task.complexity}`);
    }
}
// ============================================================================
// Main Entry Point
// ============================================================================
function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        console.log('Usage: task-list.ts --session <ID> [--status open|resolved] [--format json|table]');
        process.exit(0);
    }
    // Validate required args
    if (!args.session) {
        console.error('Error: --session required');
        process.exit(1);
    }
    try {
        // Get session directory
        const sessionDir = (0, session_utils_1.getSessionDir)(args.session);
        const tasksDir = path.join(sessionDir, 'tasks');
        // Collect tasks
        const tasks = collectTasks(tasksDir, args.status);
        // Output in requested format
        if (args.format === 'json') {
            outputJson(tasks);
        }
        else {
            outputTable(tasks);
        }
        process.exit(0);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        process.exit(1);
    }
}
// Run if invoked directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=task-list.js.map