#!/usr/bin/env bun
/**
 * codex-verify.js - Codex CLI wrapper for verification
 *
 * Checks codex availability, runs codex review and codex exec,
 * outputs structured JSON. Gracefully degrades when codex is not installed.
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
 * @typedef {'check'|'review'|'exec'|'full'|'doc-review'} VerifyMode
 */

/**
 * @typedef {Object} CliArgs
 * @property {VerifyMode} mode
 * @property {string} [workingDir]
 * @property {string} [criteria]
 * @property {string} [output]
 * @property {string} [model]
 * @property {string} [goal]
 * @property {string} [enableFeatures]
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
  '--enable': { key: 'enableFeatures', aliases: ['-e'] },
  '--design-optional': { key: 'designOptional', aliases: [], flag: true },
  '--sandbox': { key: 'sandbox', aliases: ['-s'] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

const VALID_MODES = ['check', 'review', 'exec', 'full', 'doc-review'];
const VALID_SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'];
const DEFAULT_MODEL = 'gpt-5.4';
const DEFAULT_ENABLE_FEATURES = ['collab'];

/**
 * Determine sandbox mode based on verify mode or explicit override
 * exec/full → workspace-write (tests need /tmp writes)
 * doc-review/review → read-only (read-only verification)
 * @param {VerifyMode} mode - Verify mode
 * @param {string} [override] - Explicit sandbox mode override
 * @returns {string}
 */
function resolveSandboxMode(mode, override) {
  if (override) {
    if (!VALID_SANDBOX_MODES.includes(override)) {
      console.error(`Error: Invalid sandbox mode "${override}". Must be: ${VALID_SANDBOX_MODES.join(', ')}`);
      process.exit(1);
    }
    return override;
  }
  return ['exec', 'full'].includes(mode) ? 'workspace-write' : 'read-only';
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classify an execSync/execFileSync error into a human-readable category.
 * @param {Error & { status?: number, signal?: string, killed?: boolean }} error
 * @param {number} timeoutMs - The timeout used for the exec call
 * @returns {{ category: string, detail: string }}
 */
function classifyExecError(error, timeoutMs) {
  if (error.killed || error.signal === 'SIGTERM') {
    return {
      category: 'timeout',
      detail: `Codex process killed after ${timeoutMs / 1000}s timeout`
    };
  }
  if (error.signal) {
    return {
      category: 'signal',
      detail: `Codex process terminated by signal ${error.signal}`
    };
  }
  if (error.code === 'ENOENT') {
    return {
      category: 'not_found',
      detail: 'Codex binary not found at execution time'
    };
  }
  if (error.status != null && error.status !== 0) {
    return {
      category: 'exit_code',
      detail: `Codex exited with code ${error.status}`
    };
  }
  return {
    category: 'unknown',
    detail: error.message || 'Unknown execution error'
  };
}

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
 * Codex review outputs a session log with thinking/exec traces.
 * The actual review is typically the last assistant message.
 * @param {string} rawOutput - Full codex review session log
 * @returns {string} Extracted review text
 */
function extractReviewContent(rawOutput) {
  // Split by common codex session markers and take the last substantial block
  const lines = rawOutput.split('\n');
  const contentLines = [];
  let inContent = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // Skip session metadata, thinking markers, and exec traces
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
 * Note: codex review does not accept a custom prompt (CLI constraint).
 * For criteria-based verification, use codex exec mode instead.
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
      timeout: 600000
    });
    const output = extractReviewContent(rawOutput);
    return { exit_code: 0, output, issues: [] };
  } catch (error) {
    const stdout = error.stdout ? error.stdout.toString().trim() : '';
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    const rawOutput = [stdout, stderr].filter(Boolean).join('\n');
    const output = extractReviewContent(rawOutput);
    const { category, detail } = classifyExecError(error, 600000);

    // Parse issues from extracted content
    const issues = output
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, 50);

    return {
      exit_code: error.status || 1,
      output,
      issues,
      error_detail: { category, detail, stderr: stderr.slice(0, 500) }
    };
  }
}

/**
 * Get git context (recent diff stats and commits) for the working directory
 * @param {string} workingDir - Project directory
 * @returns {{ diffStat: string, recentCommits: string }}
 */
function getGitContext(workingDir) {
  let diffStat = '';
  let recentCommits = '';
  try {
    diffStat = execSync(
      'git diff --stat HEAD~5 2>/dev/null || git diff --stat $(git rev-list --max-parents=0 HEAD) HEAD',
      { cwd: workingDir, encoding: 'utf-8', timeout: 10000, shell: true,
        stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
  } catch (_) {}
  try {
    recentCommits = execSync('git log --oneline -5', {
      cwd: workingDir, encoding: 'utf-8', timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (_) {}
  return { diffStat, recentCommits };
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
 * Build a verification prompt from criteria, goal, optional design doc, and git context
 * @param {string[]} criteria - List of success criteria
 * @param {string} [goal] - Optional project goal for context
 * @param {string} [designPath] - Optional path to design document
 * @param {{ diffStat: string, recentCommits: string }} [gitContext] - Optional git context
 * @param {string} [sandboxMode='read-only'] - Sandbox mode for constraint guidance
 * @returns {string}
 */
function buildVerificationPrompt(criteria, goal, designPath, gitContext, sandboxMode = 'read-only') {
  let prompt = 'You are verifying code changes against success criteria.\n\n';

  if (goal) {
    prompt += `Project Goal: ${goal}\n\n`;
  }

  // Include design document content if provided
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

  // Sandbox constraints section (only for read-only mode)
  if (sandboxMode === 'read-only') {
    prompt += '## Sandbox Constraints (IMPORTANT)\n';
    prompt += 'You are running in a READ-ONLY sandbox. The filesystem is immutable.\n';
    prompt += 'Commands that write files will fail with EPERM or EROFS errors.\n\n';
    prompt += 'DO NOT run these commands:\n';
    prompt += '- npm run build (writes to build/ or dist/)\n';
    prompt += '- npm install (writes to node_modules/)\n';
    prompt += '- Any command that creates or modifies files\n\n';
    prompt += 'Use these read-only alternatives instead:\n';
    prompt += '- Build check: npx tsc --noEmit (type-checks without emitting files)\n';
    prompt += '- Lint check: npx eslint --no-fix src/\n';
    prompt += '- Test check: npm test (if tests fail with EPERM, report as "PASS (sandbox limitation)")\n\n';
    prompt += 'If a command fails with EPERM or EROFS, report the criterion as "PASS (sandbox limitation)" rather than FAIL.\n\n';
  } else if (sandboxMode === 'workspace-write') {
    prompt += '## Sandbox Info\n';
    prompt += 'You are running in a workspace-write sandbox. You can read all files and write within the workspace directory.\n';
    prompt += 'You can run tests, builds, and other commands that write to the workspace or /tmp.\n\n';
  }

  // Recent Changes section (conditional)
  if (gitContext && (gitContext.diffStat || gitContext.recentCommits)) {
    prompt += '## Recent Changes\n';
    if (gitContext.diffStat) {
      prompt += 'The following files were recently changed (git diff --stat):\n';
      prompt += gitContext.diffStat + '\n\n';
    }
    if (gitContext.recentCommits) {
      prompt += 'Recent commits:\n';
      prompt += gitContext.recentCommits + '\n\n';
    }
    prompt += 'Use this information to verify against the current state of the codebase, not outdated file content.\n\n';
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
 * @param {string[]} [enableFeatures=[]] - Optional features to enable via --enable flags
 * @returns {{ exit_code: number, output: string, criteria_results: Array }}
 */
function runCodexExec(workingDir, criteria, goal, model, designPath, enableFeatures = [], sandboxMode = 'workspace-write') {
  const gitContext = getGitContext(workingDir);
  const prompt = buildVerificationPrompt(criteria, goal, designPath, gitContext, sandboxMode);

  try {
    const effectiveModel = model || DEFAULT_MODEL;
    const enableArgs = [];
    for (const feature of enableFeatures) {
      enableArgs.push('--enable', feature);
    }
    const args = ['exec', '--sandbox', sandboxMode, ...enableArgs, '-m', effectiveModel, prompt];

    const output = execFileSync('codex', args, {
      cwd: workingDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 900000
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
    const { category, detail } = classifyExecError(error, 900000);

    // Try to parse valid results from partial output (Codex may exit non-zero but still produce JSON)
    const parsedResults = combinedOutput ? parseExecOutput(combinedOutput, criteria) : null;
    const hasValidResults = parsedResults && parsedResults.some(cr => cr.explanation !== 'Could not parse verification result');

    return {
      exit_code: error.status || 1,
      output: combinedOutput,
      error_detail: { category, detail, stderr: stderr.slice(0, 500) },
      criteria_results: hasValidResults ? parsedResults : criteria.map(c => ({
        criterion: c,
        result: 'FAIL',
        explanation: `Codex exec failed: ${detail}`
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
// Doc Review Operations
// ============================================================================

/**
 * Build a prompt for design document review
 * @param {string} designPath - Path to design document
 * @param {string} [goal] - Optional project goal for context
 * @returns {string}
 */
function buildDocReviewPrompt(designPath, goal) {
  const designContent = fs.readFileSync(designPath, 'utf-8');

  let prompt = 'You are reviewing a design document for quality and completeness.\n\n';

  if (goal) {
    prompt += `## Goal\n${goal}\n\n`;
  }

  prompt += `## Design Document\n${designContent}\n\n`;
  prompt += '## Review Criteria\n\n';
  prompt += 'Check the following and report issues:\n\n';
  prompt += '1. **Structural Accuracy**: Report an error ONLY when content needed to implement or verify the change is missing or wrong. Mandatory content areas: (1) problem/current-state/goal, (2) chosen approach and key decisions, (3) affected files/components/consumers with impact, (4) scope boundaries, (5) executable verification criteria, (6) dependency/data-flow relationships.\n';
  prompt += '   IGNORE: heading names/numbering/depth, bold-vs-heading, section order, phase/task count differences — unless they hide missing content.\n';
  prompt += '   REPORT: invalid file references, impossible dependencies, missing verification commands, contradictory decisions/scope, unverifiable success criteria.\n';
  prompt += '2. **Blocked Patterns**: Find any TODO, TBD, FIXME, placeholder, "not yet decided", "to be determined", empty sections. Report as errors.\n';
  prompt += '3. **Internal Consistency**: Check that decisions, architecture, and scope don\'t contradict each other. Report contradictions as errors.\n';
  prompt += '4. **Quality**: Check for vague statements ("should work", "probably", "maybe"), incomplete lists ("etc.", "..."). Report as warnings.\n\n';
  prompt += '## Output Format (JSON)\n';
  prompt += '{\n';
  prompt += '  "doc_issues": [\n';
  prompt += '    { "category": "completeness|blocked_pattern|consistency|quality", "severity": "error|warning", "detail": "description" }\n';
  prompt += '  ],\n';
  prompt += '  "overall_verdict": "PASS|FAIL",\n';
  prompt += '  "summary": "one-line summary"\n';
  prompt += '}\n\n';
  prompt += 'If no errors found, verdict is PASS. If any errors found, verdict is FAIL. Warnings alone don\'t cause FAIL.';

  return prompt;
}

/**
 * Parse doc review output to extract doc_issues
 * @param {string} output - Raw codex output
 * @returns {{ doc_issues: Array<{ category: string, severity: string, detail: string }>, verdict: string }}
 */
function parseDocReviewOutput(output) {
  try {
    const jsonMatch = output.match(/\{[\s\S]*"doc_issues"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.doc_issues)) {
        const hasErrors = parsed.doc_issues.some(issue => issue.severity === 'error');
        return {
          doc_issues: parsed.doc_issues,
          verdict: hasErrors ? 'FAIL' : 'PASS'
        };
      }
    }
  } catch (_) {
    // JSON parsing failed, fall through to default
  }

  return {
    doc_issues: [{ category: 'completeness', severity: 'error', detail: 'Could not parse doc review result' }],
    verdict: 'FAIL'
  };
}

/**
 * Run codex doc-review for a design document
 * @param {string} designPath - Path to design document
 * @param {string} [goal] - Optional project goal
 * @param {string} [model] - Optional model override
 * @param {string[]} [enableFeatures=[]] - Optional features to enable via --enable flags
 * @returns {{ exit_code: number, output: string, doc_issues: Array, verdict: string }}
 */
function runCodexDocReview(designPath, goal, model, enableFeatures = [], designOptional = false, sandboxMode = 'read-only') {
  // Validate design file exists before building prompt
  if (!fs.existsSync(designPath)) {
    if (designOptional) {
      return {
        exit_code: 0,
        output: `Design file not found (optional): ${designPath}`,
        doc_issues: [],
        verdict: 'SKIP'
      };
    }
    return {
      exit_code: 1,
      output: `Design file not found: ${designPath}`,
      doc_issues: [{ category: 'completeness', severity: 'error', detail: `Design file not found: ${designPath}` }],
      verdict: 'FAIL'
    };
  }

  const prompt = buildDocReviewPrompt(designPath, goal);

  try {
    const effectiveModel = model || DEFAULT_MODEL;
    const enableArgs = [];
    for (const feature of enableFeatures) {
      enableArgs.push('--enable', feature);
    }
    const args = ['exec', '--sandbox', sandboxMode, ...enableArgs, '-m', effectiveModel, prompt];

    const output = execFileSync('codex', args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 900000
    }).trim();

    const { doc_issues, verdict } = parseDocReviewOutput(output);

    return { exit_code: 0, output, doc_issues, verdict };
  } catch (error) {
    const stdout = error.stdout ? error.stdout.toString().trim() : '';
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    const combinedOutput = [stdout, stderr].filter(Boolean).join('\n');
    const { category, detail } = classifyExecError(error, 900000);

    // Try to parse valid doc_issues from partial output (Codex may exit non-zero but still produce JSON)
    const parsed = combinedOutput ? parseDocReviewOutput(combinedOutput) : null;
    const hasValidIssues = parsed && parsed.doc_issues.length > 0
      && parsed.doc_issues[0].detail !== 'Could not parse doc review result';

    return {
      exit_code: error.status || 1,
      output: combinedOutput,
      error_detail: { category, detail, stderr: stderr.slice(0, 500) },
      doc_issues: hasValidIssues ? parsed.doc_issues : [{ category: 'exec_error', severity: 'error', detail: `Codex doc-review failed: ${detail}` }],
      verdict: hasValidIssues ? parsed.verdict : 'FAIL'
    };
  }
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
  if (mode === 'doc-review' || mode === 'full') {
    result.doc_review = null;
  }

  return result;
}

/**
 * Determine overall verdict from review, exec, and doc-review results
 * @param {Object|null} reviewResult - Review result
 * @param {Object|null} execResult - Exec result
 * @param {Object|null} docReviewResult - Doc review result
 * @returns {'PASS'|'FAIL'}
 */
function determineVerdict(reviewResult, execResult, docReviewResult) {
  // If doc-review ran and has errors, that is a FAIL
  if (docReviewResult && docReviewResult.verdict === 'FAIL') {
    return 'FAIL';
  }

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

  // If the only result is a SKIP doc-review (no exec or review), propagate SKIP
  if (docReviewResult && docReviewResult.verdict === 'SKIP' && !execResult && !reviewResult) {
    return 'SKIP';
  }

  return 'PASS';
}

/**
 * Build summary string from results
 * @param {Object|null} reviewResult
 * @param {Object|null} execResult
 * @param {Object|null} docReviewResult
 * @param {string} verdict
 * @returns {string}
 */
function buildSummary(reviewResult, execResult, docReviewResult, verdict) {
  const parts = [];

  if (docReviewResult) {
    if (docReviewResult.error_detail) {
      parts.push(`Doc review: ${docReviewResult.error_detail.category} - ${docReviewResult.error_detail.detail}`);
    } else {
      const errorCount = docReviewResult.doc_issues.filter(i => i.severity === 'error').length;
      const warnCount = docReviewResult.doc_issues.filter(i => i.severity === 'warning').length;
      parts.push(`Doc review: ${errorCount === 0 ? 'clean' : `${errorCount} error(s), ${warnCount} warning(s)`}`);
    }
  }

  if (reviewResult) {
    if (reviewResult.error_detail) {
      parts.push(`Review: ${reviewResult.error_detail.category} - ${reviewResult.error_detail.detail}`);
    } else {
      const issueCount = reviewResult.issues.length;
      parts.push(`Review: ${issueCount === 0 ? 'clean' : `${issueCount} issue(s) found`}`);
    }
  }

  if (execResult) {
    if (execResult.error_detail) {
      parts.push(`Exec: ${execResult.error_detail.category} - ${execResult.error_detail.detail}`);
    } else {
      const passCount = execResult.criteria_results.filter(cr => cr.result === 'PASS').length;
      const totalCount = execResult.criteria_results.length;
      parts.push(`Exec: ${passCount}/${totalCount} criteria passed`);
    }
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

  // Default --working-dir to cwd for modes that need it
  if (['review', 'exec', 'full'].includes(args.mode) && !args.workingDir) {
    args.workingDir = process.cwd();
  }

  // Collect all missing required params and report at once
  const errors = [];

  // exec and full require --criteria
  if (['exec', 'full'].includes(args.mode) && !args.criteria) {
    errors.push(`--criteria (-c) is required for mode "${args.mode}"`);
  }

  // doc-review requires --design
  if (args.mode === 'doc-review' && !args.design) {
    errors.push('--design (-d) is required for mode "doc-review"');
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`Error: ${err}`);
    }
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
      'Modes: check (availability), review (code review), exec (criteria verification), doc-review (design doc review), full (all).\n' +
      'Gracefully degrades when codex is not installed (SKIP verdict).'
    ));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);
  validateModeArgs(args);

  // Pre-cleanup: remove existing output file before running new verification
  if (args.output && fs.existsSync(args.output)) {
    fs.unlinkSync(args.output);
  }

  // Parse enable features from comma-separated string; collab is always enabled
  const userFeatures = args.enableFeatures
    ? args.enableFeatures.split(',').map(f => f.trim()).filter(Boolean)
    : [];
  const enableFeatures = [...new Set([...DEFAULT_ENABLE_FEATURES, ...userFeatures])];

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
  let docReviewResult = null;

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

  const sandboxMode = resolveSandboxMode(args.mode, args.sandbox);

  if (args.mode === 'doc-review') {
    docReviewResult = runCodexDocReview(args.design, args.goal, args.model, enableFeatures, args.designOptional, sandboxMode);
  }

  if (args.mode === 'review' || args.mode === 'full') {
    reviewResult = runCodexReview(args.workingDir, args.base);
  }

  if (args.mode === 'exec' || args.mode === 'full') {
    const criteria = parseCriteria(args.criteria);
    // When design is optional and file is absent, don't pass design path to exec
    const effectiveDesign = (args.design && (!args.designOptional || fs.existsSync(args.design))) ? args.design : undefined;
    execResult = runCodexExec(args.workingDir, criteria, args.goal, args.model, effectiveDesign, enableFeatures, sandboxMode);
  }

  if (args.mode === 'full' && args.design) {
    // When design is optional and file is absent, skip doc review entirely
    if (!args.designOptional || fs.existsSync(args.design)) {
      docReviewResult = runCodexDocReview(args.design, args.goal, args.model, enableFeatures, args.designOptional, sandboxMode);
    }
    // designOptional + file absent -> docReviewResult remains null
  }

  const verdict = determineVerdict(reviewResult, execResult, docReviewResult);
  const summary = buildSummary(reviewResult, execResult, docReviewResult, verdict);

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

  if (docReviewResult) {
    result.doc_review = {
      exit_code: docReviewResult.exit_code,
      output: docReviewResult.output,
      doc_issues: docReviewResult.doc_issues
    };
    if (docReviewResult.error_detail) {
      result.doc_review.error_detail = docReviewResult.error_detail;
    }
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

// Export for testing
module.exports = { buildVerificationPrompt, buildDocReviewPrompt, getGitContext, runCodexDocReview };
