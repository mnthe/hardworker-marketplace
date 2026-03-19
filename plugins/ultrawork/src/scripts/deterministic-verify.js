#!/usr/bin/env bun
/**
 * deterministic-verify.js - Rule-based verification for ultrawork sessions
 *
 * Runs deterministic checks against a session based on rules from:
 * 1. Default rules: ../rules/phase-rules.json
 * 2. Project overrides: {working-dir}/.claude/ultrawork-rules.json
 *
 * Check types: task_status, evidence_count, command, glob
 * Output: JSON with verdict (PASS/FAIL), checks[], and failed[]
 *
 * Usage: deterministic-verify.js --session <ID> [--working-dir <dir>]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getSessionDir, readSession } = require('../lib/session-utils.js');

// ============================================================================
// CLI Argument Parsing (inline, matching args.js pattern)
// ============================================================================

const ARG_SPEC = {
  '--session': { key: 'session', aliases: ['-s'], required: true },
  '--working-dir': { key: 'workingDir', aliases: ['-w'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

const SCRIPT_NAME = 'deterministic-verify.js';
const DESCRIPTION = 'Run rule-based verification checks against an ultrawork session.';

function printHelp() {
  let help = `Usage: ${SCRIPT_NAME} [options]\n`;
  help += `\n${DESCRIPTION}\n`;
  help += '\nOptions:\n';
  for (const [flag, opt] of Object.entries(ARG_SPEC)) {
    const aliases = opt.aliases?.length > 0 ? `, ${opt.aliases.join(', ')}` : '';
    const required = opt.required ? ' (required)' : '';
    const flagType = opt.flag ? '' : ' <value>';
    help += `  ${flag}${aliases}${flagType}${required}\n`;
  }
  return help;
}

function parseCliArgs() {
  const argv = process.argv;
  const args = {};

  // Build alias map
  const aliasMap = {};
  for (const [flag, opt] of Object.entries(ARG_SPEC)) {
    if (opt.aliases) {
      for (const alias of opt.aliases) {
        aliasMap[alias] = flag;
      }
    }
    if (opt.flag) {
      args[opt.key] = false;
    }
  }

  for (let i = 2; i < argv.length; i++) {
    let arg = argv[i];
    if (aliasMap[arg]) {
      arg = aliasMap[arg];
    }
    const opt = ARG_SPEC[arg];
    if (!opt) continue;
    if (opt.flag) {
      args[opt.key] = true;
    } else {
      args[opt.key] = argv[++i];
    }
  }

  // Handle --help
  if (args.help) {
    console.log(printHelp());
    process.exit(0);
  }

  // Validate required
  for (const [flag, opt] of Object.entries(ARG_SPEC)) {
    if (opt.required && args[opt.key] === undefined) {
      console.error(`Error: ${flag} is required`);
      process.exit(1);
    }
  }

  return args;
}

// ============================================================================
// Rule Loading & Merging
// ============================================================================

function loadDefaultRules() {
  const rulesPath = path.join(__dirname, '..', 'rules', 'phase-rules.json');
  const content = fs.readFileSync(rulesPath, 'utf-8');
  return JSON.parse(content);
}

function loadProjectRules(workingDir) {
  if (!workingDir) return null;
  const rulesPath = path.join(workingDir, '.claude', 'ultrawork-rules.json');
  if (!fs.existsSync(rulesPath)) return null;
  const content = fs.readFileSync(rulesPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Merge default + project checks. Same name -> project wins.
 */
function mergeChecks(defaultRules, projectRules) {
  const checksMap = new Map();

  // Add default checks
  for (const check of defaultRules.checks || []) {
    checksMap.set(check.name, check);
  }

  // Override/add project checks
  if (projectRules && projectRules.checks) {
    for (const check of projectRules.checks) {
      checksMap.set(check.name, check);
    }
  }

  return Array.from(checksMap.values());
}

// ============================================================================
// Check Executors
// ============================================================================

/**
 * task_status: verify all tasks match expected status
 */
function runTaskStatusCheck(check, sessionDir) {
  const tasksDir = path.join(sessionDir, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    return { name: check.name, type: check.type, passed: false, detail: 'No tasks directory found' };
  }

  const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
  if (taskFiles.length === 0) {
    return { name: check.name, type: check.type, passed: false, detail: 'No task files found' };
  }

  const expected = check.expected || 'resolved';
  const failedTasks = [];

  for (const file of taskFiles) {
    const content = fs.readFileSync(path.join(tasksDir, file), 'utf-8');
    const task = JSON.parse(content);
    if (task.status !== expected) {
      failedTasks.push({ id: task.id, status: task.status });
    }
  }

  if (failedTasks.length > 0) {
    return {
      name: check.name,
      type: check.type,
      passed: false,
      detail: `Tasks not ${expected}: ${failedTasks.map(t => `${t.id}(${t.status})`).join(', ')}`
    };
  }

  return { name: check.name, type: check.type, passed: true, detail: `All ${taskFiles.length} tasks are ${expected}` };
}

/**
 * evidence_count: count evidence entries of given type, check >= min
 */
function runEvidenceCountCheck(check, sessionDir) {
  const logPath = path.join(sessionDir, 'evidence', 'log.jsonl');
  if (!fs.existsSync(logPath)) {
    return { name: check.name, type: check.type, passed: false, detail: 'No evidence log found' };
  }

  const content = fs.readFileSync(logPath, 'utf-8').trim();
  if (!content) {
    return { name: check.name, type: check.type, passed: false, detail: 'Evidence log is empty' };
  }

  const lines = content.split('\n');
  const evidenceType = check.evidence_type;
  const min = check.min || 1;

  let count = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === evidenceType) {
        count++;
      }
    } catch {
      // Skip malformed lines
    }
  }

  const passed = count >= min;
  return {
    name: check.name,
    type: check.type,
    passed,
    detail: passed
      ? `Found ${count} ${evidenceType} entries (min: ${min})`
      : `Found ${count} ${evidenceType} entries, need at least ${min}`
  };
}

/**
 * command: run shell command, exit 0 = PASS
 */
function runCommandCheck(check, workingDir) {
  const timeout = check.timeout || 30000;
  const cwd = workingDir || process.cwd();

  try {
    execSync(check.command, {
      timeout,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { name: check.name, type: check.type, passed: true, detail: `Command succeeded: ${check.command}` };
  } catch (err) {
    if (err.killed || (err.signal === 'SIGTERM')) {
      return {
        name: check.name,
        type: check.type,
        passed: false,
        detail: `timeout after ${timeout}ms: ${check.command}`
      };
    }
    return {
      name: check.name,
      type: check.type,
      passed: false,
      detail: `Command failed (exit ${err.status}): ${check.command}`
    };
  }
}

/**
 * glob: match files against pattern, count >= min_matches
 */
function runGlobCheck(check, workingDir) {
  const cwd = workingDir || process.cwd();
  const pattern = check.pattern;
  const minMatches = check.min_matches || 1;

  // Use Bun.Glob for pattern matching
  const glob = new Bun.Glob(pattern);
  const matches = Array.from(glob.scanSync({ cwd, dot: false }));

  const passed = matches.length >= minMatches;
  return {
    name: check.name,
    type: check.type,
    passed,
    detail: passed
      ? `Found ${matches.length} matches for ${pattern} (min: ${minMatches})`
      : `Found ${matches.length} matches for ${pattern}, need at least ${minMatches}`
  };
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = parseCliArgs();
  const sessionId = args.session;

  // Read session to get working_dir if not provided
  const sessionDir = getSessionDir(sessionId);
  let workingDir = args.workingDir;

  if (!workingDir) {
    try {
      const session = readSession(sessionId);
      workingDir = session.working_dir;
    } catch {
      // No working dir available; commands/globs will use cwd
    }
  }

  // Load and merge rules
  const defaultRules = loadDefaultRules();
  const projectRules = loadProjectRules(workingDir);
  const checks = mergeChecks(defaultRules, projectRules);

  // Execute each check
  const results = [];
  for (const check of checks) {
    let result;
    switch (check.type) {
      case 'task_status':
        result = runTaskStatusCheck(check, sessionDir);
        break;
      case 'evidence_count':
        result = runEvidenceCountCheck(check, sessionDir);
        break;
      case 'command':
        result = runCommandCheck(check, workingDir);
        break;
      case 'glob':
        result = runGlobCheck(check, workingDir);
        break;
      default:
        result = { name: check.name, type: check.type, passed: false, detail: `Unknown check type: ${check.type}` };
    }
    results.push(result);
  }

  // Compute verdict
  const failed = results.filter(r => !r.passed).map(r => r.name);
  const verdict = failed.length === 0 ? 'PASS' : 'FAIL';

  // Output JSON
  const output = {
    verdict,
    checks: results,
    failed
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main();
