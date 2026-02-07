#!/usr/bin/env bun

/**
 * codex-verify.js - Codex CLI wrapper for verification (teamwork plugin)
 *
 * Checks codex availability, runs codex review and codex exec,
 * outputs structured JSON. Gracefully degrades when codex is not installed.
 *
 * Used by teamwork plugin for AI-powered code verification and criteria validation.
 *
 * Usage: codex-verify.js --mode <check|review|exec|full> [options]
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {'check'|'review'|'exec'|'full'} VerifyMode
 */

/**
 * @typedef {Object} CliArgs
 * @property {VerifyMode} mode
 * @property {string} [workingDir]
 * @property {string} [criteria]
 * @property {string} [output]
 * @property {string} [model]
 * @property {string} [goal]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--mode': { key: 'mode', aliases: ['-m'], required: true },
  '--working-dir': { key: 'workingDir', aliases: ['-w'] },
  '--criteria': { key: 'criteria', aliases: ['-c'] },
  '--output': { key: 'output', aliases: ['-o'] },
  '--model': { key: 'model', aliases: ['-M'] },
  '--goal': { key: 'goal', aliases: ['-g'] },
  '--base': { key: 'base', aliases: ['-b'] },
  '--design': { key: 'design', aliases: ['-d'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

const VALID_MODES = ['check', 'review', 'exec', 'full'];
const DEFAULT_MODEL = 'gpt-5.3-codex';

// ============================================================================
// Codex Availability
// ============================================================================

/**
 * Check if codex CLI is available on the system
 * @returns {{ available: boolean, version: string|null, path: string|null }}
 */
function checkCodexAvailability() {
  try {
    const codexPath = execSync('which codex', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    let version = null;
    try {
      version = execSync('codex --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (_) {
      // version retrieval failed but codex exists
    }
    return { available: true, version, path: codexPath };
  } catch (_) {
    return { available: false, version: null, path: null };
  }
}

// ============================================================================
// Codex Operations
// ============================================================================

/**
 * Extract the final review text from codex review session log.
 * @param {string} rawOutput - Full codex review session log
 * @returns {string} Extracted review text
 */
function extractReviewContent(rawOutput) {
  const lines = rawOutput.split('\n');
  const contentLines = [];
  let inContent = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('--------') || line.startsWith('session id:') ||
        line.startsWith('model:') || line.startsWith('provider:') ||
        line.startsWith('sandbox:') || line.startsWith('approval:') ||
        line.startsWith('workdir:') || line.startsWith('reasoning') ||
        line.startsWith('mcp startup:') || line === 'user' ||
        line === 'thinking' || line === 'exec') {
      if (inContent) break;
      continue;
    }
    if (line.trim().length > 0) {
      inContent = true;
      contentLines.unshift(line);
    }
  }

  return contentLines.join('\n').trim() || rawOutput.trim();
}

/**
 * Detect the default branch for the repo (main/master/develop).
 * @param {string} workingDir - Project directory
 * @returns {string|null} Branch name or null
 */
function detectDefaultBranch(workingDir) {
  const candidates = ['main', 'master', 'develop'];
  for (const branch of candidates) {
    try {
      execSync(`git rev-parse --verify ${branch}`, {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return branch;
    } catch (_) {}
  }
  return null;
}

/**
 * Run codex review in the specified directory.
 * Review strategy:
 *   1. If --base is provided, review against that ref
 *   2. Otherwise, auto-detect default branch and use --base
 *   3. Fall back to --uncommitted if no base found
 * @param {string} workingDir - Project directory
 * @param {string} [base] - Base branch or commit ref to diff against
 * @returns {{ exit_code: number, output: string, issues: string[] }}
 */
function runCodexReview(workingDir, base) {
  const effectiveBase = base || detectDefaultBranch(workingDir);
  const reviewArg = effectiveBase ? `--base ${effectiveBase}` : '--uncommitted';
  try {
    const rawOutput = execSync(`codex review ${reviewArg}`, {
      cwd: workingDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 180000
    });
    const output = extractReviewContent(rawOutput);
    return { exit_code: 0, output, issues: [] };
  } catch (error) {
    const stdout = error.stdout ? error.stdout.toString().trim() : '';
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    const rawOutput = [stdout, stderr].filter(Boolean).join('\n');
    const output = extractReviewContent(rawOutput);

    const issues = output
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, 50);

    return {
      exit_code: error.status || 1,
      output,
      issues
    };
  }
}

/**
 * Parse pipe-separated criteria string into array
 * @param {string} criteriaStr - Pipe-separated criteria
 * @returns {string[]}
 */
function parseCriteria(criteriaStr) {
  if (!criteriaStr || criteriaStr.trim() === '') {
    return [];
  }
  return criteriaStr
    .split('|')
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

/**
 * Build a verification prompt from criteria, goal, and optional design doc
 * @param {string[]} criteria - List of success criteria
 * @param {string} [goal] - Optional project goal for context
 * @param {string} [designPath] - Optional path to design document
 * @returns {string}
 */
function buildVerificationPrompt(criteria, goal, designPath) {
  let prompt = 'You are verifying code changes against success criteria.\n\n';

  if (goal) {
    prompt += `Project Goal: ${goal}\n\n`;
  }

  if (designPath) {
    try {
      const designContent = fs.readFileSync(designPath, 'utf-8');
      prompt += '## Design Document\n\n';
      prompt += designContent.trim();
      prompt += '\n\n---\n\n';
    } catch (_) {
      prompt += `(Design file not found: ${designPath})\n\n`;
    }
  }

  prompt += 'Verify each of the following criteria by reading code and running read-only commands.\n';
  prompt += 'For each criterion, respond with PASS or FAIL and a brief explanation.\n\n';
  prompt += 'Success Criteria:\n';

  criteria.forEach((criterion, i) => {
    prompt += `${i + 1}. ${criterion}\n`;
  });

  prompt += '\nProvide your assessment as JSON with this structure:\n';
  prompt += '{\n';
  prompt += '  "criteria_results": [\n';
  prompt += '    { "criterion": "...", "result": "PASS|FAIL", "explanation": "..." }\n';
  prompt += '  ],\n';
  prompt += '  "overall_verdict": "PASS|FAIL",\n';
  prompt += '  "summary": "Brief overall summary"\n';
  prompt += '}\n';

  return prompt;
}

/**
 * Run codex exec with a verification prompt
 * @param {string} workingDir - Project directory
 * @param {string[]} criteria - Success criteria to verify
 * @param {string} [goal] - Optional project goal
 * @param {string} [model] - Optional model override
 * @param {string} [designPath] - Optional path to design document
 * @returns {{ exit_code: number, output: string, criteria_results: Array }}
 */
function runCodexExec(workingDir, criteria, goal, model, designPath) {
  const prompt = buildVerificationPrompt(criteria, goal, designPath);

  try {
    const effectiveModel = model || DEFAULT_MODEL;
    const args = ['exec', '--sandbox', 'read-only', '-m', effectiveModel, prompt];

    const output = execFileSync('codex', args, {
      cwd: workingDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000
    }).trim();

    const criteriaResults = parseExecOutput(output, criteria);

    return {
      exit_code: 0,
      output,
      criteria_results: criteriaResults
    };
  } catch (error) {
    const stdout = error.stdout ? error.stdout.toString().trim() : '';
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    const combinedOutput = [stdout, stderr].filter(Boolean).join('\n');

    return {
      exit_code: error.status || 1,
      output: combinedOutput,
      criteria_results: criteria.map(c => ({
        criterion: c,
        result: 'FAIL',
        explanation: 'Codex exec failed'
      }))
    };
  }
}

/**
 * Parse codex exec output to extract criteria results
 * @param {string} output - Raw codex output
 * @param {string[]} criteria - Original criteria list
 * @returns {Array<{ criterion: string, result: string, explanation: string }>}
 */
function parseExecOutput(output, criteria) {
  // Try to find JSON in the output
  try {
    // Look for JSON block in output
    const jsonMatch = output.match(/\{[\s\S]*"criteria_results"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.criteria_results)) {
        return parsed.criteria_results;
      }
    }
  } catch (_) {
    // JSON parsing failed, fall through to default
  }

  // Default: map each criterion as unverified
  return criteria.map(c => ({
    criterion: c,
    result: 'FAIL',
    explanation: 'Could not parse verification result'
  }));
}

// ============================================================================
// Result Building
// ============================================================================

/**
 * Build SKIP result when codex is not available
 * @param {VerifyMode} mode - Requested mode
 * @returns {Object} Result JSON
 */
function buildSkipResult(mode) {
  const result = {
    available: false,
    mode,
    verdict: 'SKIP',
    summary: 'Codex CLI not found. Install codex to enable AI-powered verification.'
  };

  if (mode === 'review' || mode === 'full') {
    result.review = null;
  }
  if (mode === 'exec' || mode === 'full') {
    result.exec = null;
  }

  return result;
}

/**
 * Determine overall verdict from review and exec results
 * @param {Object|null} reviewResult - Review result
 * @param {Object|null} execResult - Exec result
 * @returns {'PASS'|'FAIL'}
 */
function determineVerdict(reviewResult, execResult) {
  // If exec ran and has criteria results, check them
  if (execResult) {
    const allPass = execResult.criteria_results.every(
      cr => cr.result === 'PASS'
    );
    if (!allPass) return 'FAIL';
  }

  // If review ran and had non-zero exit, that is a FAIL signal
  if (reviewResult && reviewResult.exit_code !== 0 && reviewResult.issues.length > 0) {
    return 'FAIL';
  }

  return 'PASS';
}

/**
 * Build summary string from results
 * @param {Object|null} reviewResult
 * @param {Object|null} execResult
 * @param {string} verdict
 * @returns {string}
 */
function buildSummary(reviewResult, execResult, verdict) {
  const parts = [];

  if (reviewResult) {
    const issueCount = reviewResult.issues.length;
    parts.push(`Review: ${issueCount === 0 ? 'clean' : `${issueCount} issue(s) found`}`);
  }

  if (execResult) {
    const passCount = execResult.criteria_results.filter(cr => cr.result === 'PASS').length;
    const totalCount = execResult.criteria_results.length;
    parts.push(`Exec: ${passCount}/${totalCount} criteria passed`);
  }

  parts.push(`Verdict: ${verdict}`);
  return parts.join('. ');
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate mode-specific required parameters
 * @param {CliArgs} args - Parsed CLI arguments
 */
function validateModeArgs(args) {
  if (!VALID_MODES.includes(args.mode)) {
    console.error(`Error: Invalid mode "${args.mode}". Must be: ${VALID_MODES.join(', ')}`);
    process.exit(1);
  }

  // review, exec, full all require --working-dir
  if (['review', 'exec', 'full'].includes(args.mode) && !args.workingDir) {
    console.error(`Error: --working-dir (-w) is required for mode "${args.mode}"`);
    process.exit(1);
  }

  // exec and full require --criteria
  if (['exec', 'full'].includes(args.mode) && !args.criteria) {
    console.error(`Error: --criteria (-c) is required for mode "${args.mode}"`);
    process.exit(1);
  }
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('codex-verify.js', ARG_SPEC,
      'Codex CLI wrapper for AI-powered code verification.\n' +
      'Modes: check (availability), review (code review), exec (criteria verification), full (both).\n' +
      'Gracefully degrades when codex is not installed (SKIP verdict).'
    ));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);
  validateModeArgs(args);

  // Check codex availability
  const availability = checkCodexAvailability();

  // If codex not available, output SKIP result
  if (!availability.available) {
    const result = buildSkipResult(args.mode);
    outputResult(result, args.output);
    return;
  }

  // Codex is available - execute requested mode
  let reviewResult = null;
  let execResult = null;

  if (args.mode === 'check') {
    const result = {
      available: true,
      mode: 'check',
      codex_version: availability.version,
      codex_path: availability.path,
      verdict: 'PASS',
      summary: `Codex CLI available: ${availability.version || 'unknown version'}`
    };
    outputResult(result, args.output);
    return;
  }

  if (args.mode === 'review' || args.mode === 'full') {
    reviewResult = runCodexReview(args.workingDir, args.base);
  }

  if (args.mode === 'exec' || args.mode === 'full') {
    const criteria = parseCriteria(args.criteria);
    execResult = runCodexExec(args.workingDir, criteria, args.goal, args.model, args.design);
  }

  const verdict = determineVerdict(reviewResult, execResult);
  const summary = buildSummary(reviewResult, execResult, verdict);

  const result = {
    available: true,
    mode: args.mode,
    verdict,
    summary
  };

  if (reviewResult) {
    result.review = reviewResult;
  }

  if (execResult) {
    result.exec = execResult;
  }

  outputResult(result, args.output);
}

/**
 * Output result as JSON, optionally writing to file
 * @param {Object} result - Result object
 * @param {string} [outputPath] - Optional file path to write results
 */
function outputResult(result, outputPath) {
  const json = JSON.stringify(result, null, 2);
  console.log(json);

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, json, 'utf-8');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
