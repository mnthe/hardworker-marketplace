#!/usr/bin/env node
"use strict";
/**
 * Ultrawork Setup Script
 * TypeScript port of setup-ultrawork.sh
 * v5.1: Added working_dir to session.json for project deliverables
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
function showHelp() {
    console.log(`\
═══════════════════════════════════════════════════════════
 ULTRAWORK - Strict Verification-First Development Mode
═══════════════════════════════════════════════════════════

USAGE:
  /ultrawork [OPTIONS] <GOAL...>

ARGUMENTS:
  GOAL...    Task description (can be multiple words without quotes)

OPTIONS:
  --session <id>         Session ID (required, provided by AI)
  --max-workers <n>      Maximum parallel workers (default: unlimited)
  --max-iterations <n>   Max execute→verify loops (default: 5)
  --skip-verify          Skip verification phase (fast mode)
  --plan-only            Only run planner, don't execute tasks
  --auto                 Skip plan confirmation, run automatically
  --force                Force start even if active session exists
  --resume               Resume cancelled/failed session
  -h, --help             Show this help message

═══════════════════════════════════════════════════════════`);
}
function parseArgs(argv) {
    const args = {
        sessionId: '',
        goal: '',
        maxWorkers: 0,
        maxIterations: 5,
        skipVerify: false,
        planOnly: false,
        autoMode: false,
        force: false,
        resume: false,
        help: false,
    };
    const goalParts = [];
    let i = 2; // Skip node and script path
    while (i < argv.length) {
        const arg = argv[i];
        switch (arg) {
            case '-h':
            case '--help':
                args.help = true;
                i++;
                break;
            case '--session': {
                const value = argv[i + 1];
                if (!value) {
                    console.error('❌ Error: --session requires a session ID argument');
                    process.exit(1);
                }
                args.sessionId = value;
                i += 2;
                break;
            }
            case '--max-workers': {
                const value = argv[i + 1];
                if (!value || !/^\d+$/.test(value)) {
                    console.error('❌ Error: --max-workers requires a positive integer');
                    process.exit(1);
                }
                args.maxWorkers = parseInt(value, 10);
                i += 2;
                break;
            }
            case '--max-iterations': {
                const value = argv[i + 1];
                if (!value || !/^\d+$/.test(value)) {
                    console.error('❌ Error: --max-iterations requires a positive integer');
                    process.exit(1);
                }
                args.maxIterations = parseInt(value, 10);
                i += 2;
                break;
            }
            case '--skip-verify':
                args.skipVerify = true;
                i++;
                break;
            case '--plan-only':
                args.planOnly = true;
                i++;
                break;
            case '--auto':
                args.autoMode = true;
                i++;
                break;
            case '--force':
                args.force = true;
                i++;
                break;
            case '--resume':
                args.resume = true;
                i++;
                break;
            default:
                // Positional argument (goal part)
                goalParts.push(arg);
                i++;
                break;
        }
    }
    args.goal = goalParts.join(' ');
    return args;
}
// ============================================================================
// Session Resume Logic
// ============================================================================
async function resumeSession(sessionId) {
    const sessionFile = (0, session_utils_1.getSessionFile)(sessionId);
    if (!fs.existsSync(sessionFile)) {
        console.error(`❌ Error: No session to resume (ID: ${sessionId})`);
        console.error('');
        console.error('   Active sessions:');
        const activeSessions = (0, session_utils_1.listActiveSessions)();
        if (activeSessions.length === 0) {
            console.error('     (none)');
        }
        else {
            for (const sid of activeSessions) {
                try {
                    const session = (0, session_utils_1.readSession)(sid);
                    console.error(`     ${sid}: ${session.goal || 'unknown'}`);
                }
                catch {
                    console.error(`     ${sid}: (error reading session)`);
                }
            }
        }
        process.exit(1);
    }
    // Read existing session
    const session = (0, session_utils_1.readSession)(sessionId);
    const timestamp = new Date().toISOString();
    // Clear cancelled_at if resuming
    const acquired = await (0, file_lock_1.acquireLock)(sessionFile);
    if (!acquired) {
        console.error('❌ Error: Failed to acquire session lock');
        process.exit(1);
    }
    try {
        session.cancelled_at = null;
        session.updated_at = timestamp;
        fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8');
    }
    finally {
        (0, file_lock_1.releaseLock)(sessionFile);
    }
    // Output resume message
    console.log(`\
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION RESUMED
═══════════════════════════════════════════════════════════

 Session ID: ${sessionId}
 Goal: ${session.goal}
 Resumed: ${timestamp}

═══════════════════════════════════════════════════════════`);
    // Output goal on last line for parsing
    console.log(session.goal);
    process.exit(0);
}
// ============================================================================
// Session Creation Logic
// ============================================================================
function createSession(args) {
    const { sessionId, goal, maxWorkers, maxIterations, skipVerify, planOnly, autoMode, force } = args;
    const sessionFile = (0, session_utils_1.getSessionFile)(sessionId);
    const sessionDir = (0, session_utils_1.getSessionDir)(sessionId);
    // Check for existing active session
    if (fs.existsSync(sessionFile) && !force) {
        try {
            const existing = (0, session_utils_1.readSession)(sessionId);
            const phase = existing.phase || 'unknown';
            const cancelledAt = existing.cancelled_at;
            // Session is active if not in terminal state
            const terminalPhases = ['COMPLETE', 'CANCELLED', 'FAILED'];
            const isActive = !terminalPhases.includes(phase) && !cancelledAt;
            if (isActive) {
                console.error(`⚠️  Warning: Active session exists (ID: ${sessionId})`);
                console.error(`   Goal: ${existing.goal}`);
                console.error('');
                console.error('   Use /ultrawork-cancel to cancel it first');
                console.error('   Use /ultrawork --force to override');
                process.exit(1);
            }
        }
        catch (err) {
            // If we can't read the session, treat it as inactive
        }
    }
    // Create session directory structure
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.mkdirSync(path.join(sessionDir, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(sessionDir, 'exploration'), { recursive: true });
    // Generate timestamp
    const timestamp = new Date().toISOString();
    // Get working directory (project root)
    const workingDir = process.cwd();
    // Create session.json
    const session = {
        version: '5.1',
        session_id: sessionId,
        working_dir: workingDir,
        goal: goal,
        started_at: timestamp,
        updated_at: timestamp,
        phase: 'PLANNING',
        exploration_stage: 'not_started',
        iteration: 1,
        plan: {
            approved_at: null,
        },
        options: {
            max_workers: maxWorkers,
            max_iterations: maxIterations,
            skip_verify: skipVerify,
            plan_only: planOnly,
            auto_mode: autoMode,
        },
        evidence_log: [],
        cancelled_at: null,
    };
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8');
    // Create empty context.json
    const context = {
        explorers: [],
        exploration_complete: false,
    };
    const contextFile = path.join(sessionDir, 'context.json');
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
    // Output setup message
    const maxWorkersDisplay = maxWorkers > 0 ? maxWorkers.toString() : 'unlimited';
    const executionIcon = planOnly ? '[⊘]' : '[ ]';
    const verificationIcon = skipVerify || planOnly ? '[⊘]' : '[ ]';
    console.log(`\
═══════════════════════════════════════════════════════════
 ULTRAWORK SESSION STARTED
═══════════════════════════════════════════════════════════

 Session ID: ${sessionId}
 Working Dir: ${workingDir}
 Goal: ${goal}
 Phase: PLANNING
 Started: ${timestamp}

───────────────────────────────────────────────────────────
 OPTIONS
───────────────────────────────────────────────────────────

 Max workers:    ${maxWorkersDisplay}
 Max iterations: ${maxIterations}
 Skip verify:    ${skipVerify}
 Plan only:      ${planOnly}
 Auto mode:      ${autoMode}

───────────────────────────────────────────────────────────
 SESSION DIRECTORY (Internal Metadata)
───────────────────────────────────────────────────────────

 ${sessionDir}/
   ├── session.json
   ├── context.json
   ├── exploration/
   └── tasks/

───────────────────────────────────────────────────────────
 PROJECT DELIVERABLES
───────────────────────────────────────────────────────────

 Design documents → ${workingDir}/docs/plans/
 Code changes     → ${workingDir}/

───────────────────────────────────────────────────────────
 WORKFLOW
───────────────────────────────────────────────────────────

 1. [→] PLANNING     - Explore and create task graph
 2. ${executionIcon} EXECUTION    - Workers implementing tasks
 3. ${verificationIcon} VERIFICATION - Verifier checking evidence
 4. [ ] COMPLETE     - All criteria met

───────────────────────────────────────────────────────────
 ZERO TOLERANCE RULES
───────────────────────────────────────────────────────────

 ✗ No "should work" - require evidence
 ✗ No "basic implementation" - complete work only
 ✗ No TODO/FIXME - finish everything

═══════════════════════════════════════════════════════════`);
    // Output goal on last line for parsing
    console.log(goal);
}
// ============================================================================
// Main Entry Point
// ============================================================================
async function main() {
    const args = parseArgs(process.argv);
    // Show help if requested
    if (args.help) {
        showHelp();
        process.exit(0);
    }
    // Validate --session is provided
    if (!args.sessionId) {
        console.error('❌ Error: --session is required');
        console.error('');
        console.error('   AI should provide session ID from CLAUDE_SESSION_ID.');
        console.error('   Example: setup-ultrawork.ts --session abc123 "goal"');
        process.exit(1);
    }
    // Handle --resume
    if (args.resume) {
        await resumeSession(args.sessionId);
        return;
    }
    // Validate goal is non-empty
    if (!args.goal) {
        console.error('❌ Error: No goal provided');
        console.error('');
        console.error('   Example: /ultrawork implement user authentication');
        process.exit(1);
    }
    // Create sessions directory
    const sessionsDir = (0, session_utils_1.getSessionsDir)();
    fs.mkdirSync(sessionsDir, { recursive: true });
    // Create new session
    createSession(args);
}
// Run main and handle errors
main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
//# sourceMappingURL=setup-ultrawork.js.map