#!/usr/bin/env bun
/**
 * Tests for codex-autopass.js
 *
 * Verifies the script that transforms FAIL doc-review results into PASS
 * by downgrading error-severity doc_issues to warnings.
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { runScript, assertHelpText } = require('./test-utils.js');
const fs = require('fs');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/codex-autopass.js');

describe('codex-autopass.js', () => {
  const TEST_SESSION_ID = 'test-autopass-session';
  const RESULT_FILE = `/tmp/codex-doc-${TEST_SESSION_ID}.json`;

  afterEach(() => {
    // Clean up result file after each test
    if (fs.existsSync(RESULT_FILE)) {
      fs.unlinkSync(RESULT_FILE);
    }
  });

  describe('help flag', () => {
    test('should display help with --help and exit 0', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--session']);
    });
  });

  describe('missing parameters', () => {
    test('should exit 1 when --session is missing', async () => {
      const result = await runScript(SCRIPT_PATH, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('required');
    });
  });

  describe('missing result file', () => {
    test('should exit 1 when result file does not exist', async () => {
      const result = await runScript(SCRIPT_PATH, ['--session', 'nonexistent-session']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });
  });

  describe('transforms FAIL to PASS', () => {
    test('should downgrade error issues to warnings and set PASS verdict', async () => {
      // Create a FAIL result file
      const failResult = {
        available: true,
        mode: 'doc-review',
        verdict: 'FAIL',
        summary: 'Doc review: 2 error(s), 1 warning(s). Verdict: FAIL',
        doc_review: {
          exit_code: 0,
          output: 'some codex output',
          doc_issues: [
            { category: 'completeness', severity: 'error', detail: 'Missing verification criteria' },
            { category: 'blocked_pattern', severity: 'error', detail: 'Found TODO in section 3' },
            { category: 'quality', severity: 'warning', detail: 'Vague statement in overview' }
          ]
        }
      };
      fs.writeFileSync(RESULT_FILE, JSON.stringify(failResult, null, 2), 'utf-8');

      const result = await runScript(SCRIPT_PATH, ['--session', TEST_SESSION_ID]);

      expect(result.exitCode).toBe(0);

      // Parse stdout
      const parsed = JSON.parse(result.stdout);

      // Verdict should be PASS
      expect(parsed.verdict).toBe('PASS');
      expect(parsed.available).toBe(true);
      expect(parsed.mode).toBe('doc-review');

      // All doc_issues should now be warnings
      for (const issue of parsed.doc_review.doc_issues) {
        expect(issue.severity).toBe('warning');
      }

      // Error issues should have [auto-pass] prefix
      expect(parsed.doc_review.doc_issues[0].detail).toBe('[auto-pass] Missing verification criteria');
      expect(parsed.doc_review.doc_issues[1].detail).toBe('[auto-pass] Found TODO in section 3');

      // Warning issue should keep its original detail (no double prefix)
      expect(parsed.doc_review.doc_issues[2].detail).toBe('Vague statement in overview');

      // Summary should mention auto-pass with count
      expect(parsed.summary).toContain('Auto-passed');
      expect(parsed.summary).toContain('2');
      expect(parsed.summary).toContain('downgraded to warnings');

      // doc_review output should be updated
      expect(parsed.doc_review.output).toBe('auto-pass after convergence control');
      expect(parsed.doc_review.exit_code).toBe(0);
    });

    test('should write modified result back to file', async () => {
      const failResult = {
        available: true,
        mode: 'doc-review',
        verdict: 'FAIL',
        summary: 'Some summary',
        doc_review: {
          exit_code: 1,
          output: 'some output',
          doc_issues: [
            { category: 'consistency', severity: 'error', detail: 'Contradictory scope' }
          ]
        }
      };
      fs.writeFileSync(RESULT_FILE, JSON.stringify(failResult, null, 2), 'utf-8');

      await runScript(SCRIPT_PATH, ['--session', TEST_SESSION_ID]);

      // Read back the file
      const fileContent = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf-8'));
      expect(fileContent.verdict).toBe('PASS');
      expect(fileContent.doc_review.doc_issues[0].severity).toBe('warning');
      expect(fileContent.doc_review.doc_issues[0].detail).toBe('[auto-pass] Contradictory scope');
    });
  });

  describe('edge cases', () => {
    test('should handle result with no errors (already all warnings)', async () => {
      const passResult = {
        available: true,
        mode: 'doc-review',
        verdict: 'PASS',
        summary: 'Already passing',
        doc_review: {
          exit_code: 0,
          output: 'clean review',
          doc_issues: [
            { category: 'quality', severity: 'warning', detail: 'Minor style issue' }
          ]
        }
      };
      fs.writeFileSync(RESULT_FILE, JSON.stringify(passResult, null, 2), 'utf-8');

      const result = await runScript(SCRIPT_PATH, ['--session', TEST_SESSION_ID]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.verdict).toBe('PASS');
      expect(parsed.summary).toContain('0');
      // Warning detail unchanged (no [auto-pass] prefix)
      expect(parsed.doc_review.doc_issues[0].detail).toBe('Minor style issue');
    });

    test('should handle result with empty doc_issues array', async () => {
      const emptyResult = {
        available: true,
        mode: 'doc-review',
        verdict: 'PASS',
        summary: 'Clean',
        doc_review: {
          exit_code: 0,
          output: 'no issues',
          doc_issues: []
        }
      };
      fs.writeFileSync(RESULT_FILE, JSON.stringify(emptyResult, null, 2), 'utf-8');

      const result = await runScript(SCRIPT_PATH, ['--session', TEST_SESSION_ID]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.verdict).toBe('PASS');
      expect(parsed.doc_review.doc_issues).toEqual([]);
    });

    test('should handle invalid JSON in result file', async () => {
      fs.writeFileSync(RESULT_FILE, 'not valid json{{{', 'utf-8');

      const result = await runScript(SCRIPT_PATH, ['--session', TEST_SESSION_ID]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('parse');
    });
  });
});
