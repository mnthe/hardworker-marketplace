#!/usr/bin/env node
"use strict";
/**
 * task-update.ts - Update task status and evidence
 * TypeScript port of task-update.sh
 *
 * Usage: task-update.ts --session <ID> --id <task_id> [--status open|resolved] [--add-evidence "..."]
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
const file_lock_1 = require("../lib/file-lock");
function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        const next = argv[i + 1];
        switch (arg) {
            case '--session':
                args.session = next;
                i++;
                break;
            case '--id':
                args.id = next;
                i++;
                break;
            case '--status':
                args.status = next;
                i++;
                break;
            case '--add-evidence':
                args.addEvidence = next;
                i++;
                break;
            case '-h':
            case '--help':
                args.help = true;
                break;
        }
    }
    return args;
}
// ============================================================================
// Main Logic
// ============================================================================
async function main() {
    const args = parseArgs(process.argv);
    // Handle help
    if (args.help) {
        console.log('Usage: task-update.ts --session <ID> --id <task_id> [--status open|resolved] [--add-evidence "..."]');
        process.exit(0);
    }
    // Validate required arguments
    if (!args.session || !args.id) {
        console.error('Error: --session and --id required');
        process.exit(1);
    }
    try {
        // Validate session exists
        (0, session_utils_1.resolveSessionId)(args.session);
        // Get task file path
        const sessionDir = (0, session_utils_1.getSessionDir)(args.session);
        const taskFile = path.join(sessionDir, 'tasks', `${args.id}.json`);
        // Check if task exists
        if (!fs.existsSync(taskFile)) {
            console.error(`Error: Task ${args.id} not found`);
            process.exit(1);
        }
        // Acquire lock
        const acquired = await (0, file_lock_1.acquireLock)(taskFile);
        if (!acquired) {
            console.error(`Error: Failed to acquire lock for task ${args.id}`);
            process.exit(1);
        }
        try {
            // Read current task
            const content = fs.readFileSync(taskFile, 'utf-8');
            const task = JSON.parse(content);
            // Update status if provided
            if (args.status) {
                task.status = args.status;
            }
            // Add evidence if provided
            if (args.addEvidence) {
                // Match bash behavior: add as string to evidence array
                // Note: This matches the bash implementation even though the type
                // definition suggests evidence should be TaskEvidence objects
                task.evidence.push(args.addEvidence);
            }
            // Update timestamp
            task.updated_at = new Date().toISOString();
            // Write back atomically
            const tmpFile = `${taskFile}.tmp`;
            fs.writeFileSync(tmpFile, JSON.stringify(task, null, 2), 'utf-8');
            fs.renameSync(tmpFile, taskFile);
            // Output success message and updated task
            console.log(`OK: Task ${args.id} updated`);
            console.log(JSON.stringify(task, null, 2));
        }
        finally {
            (0, file_lock_1.releaseLock)(taskFile);
        }
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
// Run main
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=task-update.js.map