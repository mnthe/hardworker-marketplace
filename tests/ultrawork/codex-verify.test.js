#!/usr/bin/env bun
/**
 * Tests for codex-verify.js
 *
 * NOTE: These tests verify graceful degradation behavior when codex CLI
 * is not installed (the expected environment for CI/test). When codex IS
 * available, the script delegates to it; those paths are tested via
 * integration testing with codex installed.
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockSession, runScript, assertHelpText } = require('./test-utils.js');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/ultrawork/src/scripts/codex-verify.js');

describe('codex-verify.js', () => {
  let session;

  beforeEach(() => {
    session = createMockSession('test-codex-verify');
  });

  afterEach(() => {
    session.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--mode', '--working-dir', '--criteria']);
    });
  });

  describe('--mode check', () => {
    test('should output JSON with available field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(typeof parsed.available).toBe('boolean');
      expect(parsed.mode).toBe('check');
      expect(parsed.verdict).toBeDefined();
    });

    test('should output SKIP verdict when codex not found', async () => {
      // In test environment, codex is not expected to be installed
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      // If codex is not installed, verdict is SKIP
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
      }
    });
  });

  describe('--mode review', () => {
    test('should require --working-dir', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'review'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--working-dir');
    });

    test('should output JSON with review field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'review',
        '--working-dir', '/tmp/test-project'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('review');
      expect(parsed.verdict).toBeDefined();
    });

    test('should output SKIP verdict when codex not found', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'review',
        '--working-dir', '/tmp/test-project'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
      }
    });
  });

  describe('--mode exec', () => {
    test('should require --working-dir', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--criteria', 'Tests pass|Code compiles'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--working-dir');
    });

    test('should require --criteria', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--working-dir', '/tmp/test-project'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--criteria');
    });

    test('should output JSON with exec field', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass|Code compiles'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('exec');
      expect(parsed.verdict).toBeDefined();
    });

    test('should output SKIP verdict when codex not found', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass|Code compiles'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
        expect(parsed.summary).toBeDefined();
      }
    });
  });

  describe('--mode full', () => {
    test('should require --working-dir', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--criteria', 'Tests pass'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--working-dir');
    });

    test('should require --criteria', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--working-dir', '/tmp/test-project'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--criteria');
    });

    test('should output JSON with both review and exec fields', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass|Code compiles'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('full');
      expect(parsed.verdict).toBeDefined();
    });

    test('should output SKIP verdict when codex not found', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass|Code compiles'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
      }
    });
  });

  describe('--mode doc-review', () => {
    // Use non-existent path for most tests: when codex is NOT available,
    // SKIP is returned before file is ever accessed. When codex IS available,
    // the fs.existsSync check returns FAIL immediately (no timeout).
    const nonExistentDesign = '/tmp/nonexistent-codex-verify-test-design-99999.md';

    test('should require --design', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--design');
    });

    test('should output JSON with mode and verdict fields', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--design', nonExistentDesign
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('doc-review');
      expect(parsed.verdict).toBeDefined();
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
        expect(parsed.doc_review).toBeNull();
      } else {
        // Codex available but file doesn't exist → FAIL with doc_issues
        expect(parsed.verdict).toBe('FAIL');
        expect(parsed.doc_review).toBeDefined();
        expect(Array.isArray(parsed.doc_review.doc_issues)).toBe(true);
      }
    });

    test('should output SKIP verdict when codex not found', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--design', nonExistentDesign
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
      }
    });

    test('should not require --working-dir', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--design', nonExistentDesign
      ]);

      // Should not fail with working-dir error (exits 0 regardless)
      expect(result.exitCode).toBe(0);
    });

    test('should return FAIL with doc_issues when design file not found', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--design', nonExistentDesign
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (parsed.available) {
        // Codex available but file missing → FAIL with descriptive doc_issues
        expect(parsed.verdict).toBe('FAIL');
        expect(parsed.doc_review).toBeDefined();
        expect(parsed.doc_review.doc_issues.length).toBeGreaterThan(0);
        expect(parsed.doc_review.doc_issues[0].detail).toContain('not found');
      }
    });
  });

  describe('--mode full with --design', () => {
    const nonExistentDesign = '/tmp/nonexistent-codex-verify-test-design-99999.md';

    test('should include doc_review in SKIP result when codex not found', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass|Code compiles',
        '--design', nonExistentDesign
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
        expect(parsed.doc_review).toBeNull();
      }
    });

    test('should still work without --design in full mode', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass|Code compiles'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('full');
      if (!parsed.available) {
        // In SKIP mode, doc_review is null for full mode
        expect(parsed.doc_review).toBeNull();
      }
    });
  });

  describe('parameter validation', () => {
    test('should fail when --mode is missing', async () => {
      const result = await runScript(SCRIPT_PATH, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--mode');
    });

    test('should fail for invalid mode', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'invalid'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid mode');
    });
  });

  describe('--output parameter', () => {
    test('should write results to file when --output specified', async () => {
      const fs = require('fs');
      const outputPath = path.join(session.sessionDir, 'codex-result.json');

      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check',
        '--output', outputPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(outputPath)).toBe(true);

      const fileContent = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      expect(fileContent.mode).toBe('check');
      expect(fileContent.verdict).toBeDefined();
    });
  });

  describe('--enable parameter', () => {
    test('help text includes --enable', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--enable']);
    });

    test('--enable parameter accepted with exec mode', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--enable', 'collab',
        '--working-dir', '/tmp/test',
        '--criteria', 'Test'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('exec');
      expect(parsed.verdict).toBeDefined();
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
      }
    });

    test('--enable parameter accepted with full mode', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--enable', 'collab,shell_snapshot',
        '--working-dir', '/tmp/test',
        '--criteria', 'Test'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('full');
      expect(parsed.verdict).toBeDefined();
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
      }
    });

    test('works without --enable (backward compat)', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--working-dir', '/tmp/test',
        '--criteria', 'Test'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('exec');
      expect(parsed.verdict).toBeDefined();
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
        expect(parsed.summary).toBeDefined();
      }
    });

    test('--enable with doc-review mode', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--enable', 'collab',
        '--design', '/tmp/nonexistent-codex-verify-test-design-99999.md'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('doc-review');
      expect(parsed.verdict).toBeDefined();
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
      }
    });
  });

  describe('JSON output structure', () => {
    test('should always include available, mode, verdict, summary fields', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);

      // Required fields in every response
      expect('available' in parsed).toBe(true);
      expect('mode' in parsed).toBe(true);
      expect('verdict' in parsed).toBe(true);
      expect('summary' in parsed).toBe(true);
    });
  });
});
