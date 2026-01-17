#!/usr/bin/env bun
/**
 * Ultrawork Setup Script
 * v5.1: Added working_dir to session.json for project deliverables
 */

const fs = require('fs');
const path = require('path');
const {
  getSessionsDir,
  getSessionDir,
  getSessionFile,
  listActiveSessions,
  readSession,
} = require('../lib/session-utils.js');
const { acquireLock, releaseLock } = require('../lib/file-lock.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Session} Session
 * @typedef {import('../lib/types.js').Context} Context
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} sessionId
 * @property {string} goal
 * @property {number} maxWorkers
 * @property {number} maxIterations
 * @property {boolean} skipVerify
 * @property {boolean} planOnly
 * @property {boolean} autoMode
 * @property {boolean} force
 * @property {boolean} resume
 * @property {boolean} worktree
 * @property {string} branch
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--session': { key: 'sessionId', aliases: ['-s'], required: true },
  '--goal': { key: 'goal', aliases: ['-g'] },
  '--max-workers': { key: 'maxWorkers', aliases: ['-w'], default: 0 },
  '--max-iterations': { key: 'maxIterations', aliases: ['-i'], default: 5 },
  '--skip-verify': { key: 'skipVerify', aliases: ['-V'], flag: true },
  '--plan-only': { key: 'planOnly', aliases: ['-p'], flag: true },
  '--auto': { key: 'autoMode', aliases: ['-a'], flag: true },
  '--force': { key: 'force', aliases: ['-f'], flag: true },
  '--resume': { key: 'resume', aliases: ['-r'], flag: true },
  '--worktree': { key: 'worktree', aliases: ['-W'], flag: true },
  '--branch': { key: 'branch', aliases: ['-b'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

/**
 * Parse command-line arguments with special handling for positional goal args
 * @param {string[]} argv - Process argv array
 * @returns {CliArgs} Parsed arguments
 */
function parseCliArgs(argv) {
  // Parse flags using common utility
  const flagArgs = parseArgs(ARG_SPEC, argv);

  // If --goal was provided, use it (prefer explicit flag over positional args)
  if (flagArgs.goal) {
    return flagArgs;
  }

  // Otherwise, collect positional arguments (backward compatibility)
  // Skip bun, script, and all flags
  const goalParts = [];
  const knownFlags = new Set([
    '--session', '-s',
    '--goal', '-g',
    '--max-workers', '-w',
    '--max-iterations', '-i',
    '--skip-verify', '-V',
    '--plan-only', '-p',
    '--auto', '-a',
    '--force', '-f',
    '--resume', '-r',
    '--worktree', '-W',
    '--branch', '-b',
    '--help', '-h'
  ]);

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    // Skip known flags
    if (knownFlags.has(arg)) {
      // Skip flag and its value (if not a boolean flag)
      if (!['--skip-verify', '-V', '--plan-only', '-p', '--auto', '-a', '--force', '-f', '--resume', '-r', '--worktree', '-W', '--help', '-h'].includes(arg)) {
        i++; // Skip next arg (the value)
      }
      continue;
    }

    // Check if this is a value for a previous flag
    if (i > 2 && knownFlags.has(argv[i - 1])) {
      continue;
    }

    // This is a positional arg (goal part)
    goalParts.push(arg);
  }

  return {
    ...flagArgs,
    goal: goalParts.join(' ')
  };
}

// ============================================================================
// Session Resume Logic
// ============================================================================

/**
 * Resume an existing session
 * @param {string} sessionId - Session ID to resume
 * @returns {Promise<void>}
 */
async function resumeSession(sessionId) {
  const sessionFile = getSessionFile(sessionId);

  if (!fs.existsSync(sessionFile)) {
    console.error(`❌ Error: No session to resume (ID: ${sessionId})`);
    console.error('');
    console.error('   Active sessions:');

    const activeSessions = listActiveSessions();
    if (activeSessions.length === 0) {
      console.error('     (none)');
    } else {
      for (const sid of activeSessions) {
        try {
          const session = readSession(sid);
          console.error(`     ${sid}: ${session.goal || 'unknown'}`);
        } catch {
          console.error(`     ${sid}: (error reading session)`);
        }
      }
    }
    process.exit(1);
  }

  // Read existing session
  const session = readSession(sessionId);
  const timestamp = new Date().toISOString();

  // Clear cancelled_at if resuming
  const acquired = await acquireLock(sessionFile);
  if (!acquired) {
    console.error('❌ Error: Failed to acquire session lock');
    process.exit(1);
  }

  try {
    session.cancelled_at = null;
    session.updated_at = timestamp;

    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8');
  } finally {
    releaseLock(sessionFile);
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

/**
 * Create new session
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function createSession(args) {
  const { sessionId, goal, maxWorkers, maxIterations, skipVerify, planOnly, autoMode, force } =
    args;

  const sessionFile = getSessionFile(sessionId);
  const sessionDir = getSessionDir(sessionId);

  // Check for existing active session
  if (fs.existsSync(sessionFile) && !force) {
    try {
      const existing = readSession(sessionId);
      const phase = existing.phase || 'unknown';
      const cancelledAt = existing.cancelled_at;

      // Session is active if not in terminal state
      const terminalPhases = ['COMPLETE', 'CANCELLED', 'FAILED'];
      const isActive = !terminalPhases.includes(phase) && !cancelledAt;

      if (isActive) {
        console.error(`⚠️  Warning: Active session exists (ID: ${sessionId})`);
        console.error(`   Goal: ${existing.goal}`);
        console.error('');
        console.error('   Use /ultrawork-clean to cancel it first');
        console.error('   Use /ultrawork --force to override');
        process.exit(1);
      }
    } catch (err) {
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
  /** @type {Session} */
  const session = {
    version: '6.0',
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

  // CRITICAL: Verify session file was written correctly
  // This prevents the "orphaned session" issue where hook blocks but file doesn't exist
  if (!fs.existsSync(sessionFile)) {
    console.error(`❌ Error: Failed to create session file`);
    console.error(`   Expected: ${sessionFile}`);
    console.error('');
    console.error('   Session setup failed. Check directory permissions.');
    process.exit(1);
  }

  // Verify content is readable and valid JSON
  try {
    const verifyContent = fs.readFileSync(sessionFile, 'utf-8');
    const verified = JSON.parse(verifyContent);
    if (verified.session_id !== sessionId) {
      throw new Error('Session ID mismatch');
    }
  } catch (verifyErr) {
    console.error(`❌ Error: Session file verification failed`);
    console.error(`   File: ${sessionFile}`);
    console.error(`   Error: ${verifyErr.message}`);
    process.exit(1);
  }

  // Create empty context.json
  /** @type {Context} */
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

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('setup-ultrawork.js', ARG_SPEC, 'Initialize ultrawork session with strict verification-first development workflow'));
    process.exit(0);
  }

  const args = parseCliArgs(process.argv);

  // Validate --session is provided
  if (!args.sessionId) {
    console.error('❌ Error: --session is required');
    console.error('');
    console.error('   AI should provide session ID from CLAUDE_SESSION_ID.');
    console.error('   Example: setup-ultrawork.js --session abc123 "goal"');
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
  const sessionsDir = getSessionsDir();
  fs.mkdirSync(sessionsDir, { recursive: true });

  // Create new session
  createSession(args);
}

// Run main and handle errors
main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
