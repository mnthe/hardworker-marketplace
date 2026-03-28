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

    test('collab is always enabled even without --enable flag', async () => {
      const fs = require('fs');
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(source).toContain("DEFAULT_ENABLE_FEATURES = ['collab']");
      // Verify merge logic: user features are merged with defaults, not replacing them
      expect(source).toContain('...DEFAULT_ENABLE_FEATURES');
    });

    test('works without --enable (collab still active)', async () => {
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

  describe('--enable collab redundancy (collab is default)', () => {
    test('exec mode: identical output with and without --enable collab', async () => {
      const withFlag = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--enable', 'collab',
        '--working-dir', '/tmp/test',
        '--criteria', 'Test'
      ]);
      const withoutFlag = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--working-dir', '/tmp/test',
        '--criteria', 'Test'
      ]);

      expect(withFlag.exitCode).toBe(withoutFlag.exitCode);
      const parsedWith = JSON.parse(withFlag.stdout);
      const parsedWithout = JSON.parse(withoutFlag.stdout);
      expect(parsedWith.mode).toBe(parsedWithout.mode);
      expect(parsedWith.verdict).toBe(parsedWithout.verdict);
      expect(parsedWith.available).toBe(parsedWithout.available);
    });

    test('full mode: identical output with and without --enable collab', async () => {
      const withFlag = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--enable', 'collab',
        '--working-dir', '/tmp/test',
        '--criteria', 'Test'
      ]);
      const withoutFlag = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--working-dir', '/tmp/test',
        '--criteria', 'Test'
      ]);

      expect(withFlag.exitCode).toBe(withoutFlag.exitCode);
      const parsedWith = JSON.parse(withFlag.stdout);
      const parsedWithout = JSON.parse(withoutFlag.stdout);
      expect(parsedWith.mode).toBe(parsedWithout.mode);
      expect(parsedWith.verdict).toBe(parsedWithout.verdict);
      expect(parsedWith.available).toBe(parsedWithout.available);
    });

    test('additional features are merged with collab default', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--enable', 'shell_snapshot',
        '--working-dir', '/tmp/test',
        '--criteria', 'Test'
      ]);

      expect(result.exitCode).toBe(0);
      // Script runs successfully - collab is still included via DEFAULT_ENABLE_FEATURES
      // shell_snapshot is added alongside collab, not replacing it
      const parsed = JSON.parse(result.stdout);
      expect(parsed.verdict).toBeDefined();
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

  describe('--design-optional flag', () => {
    const nonExistentDesign = '/tmp/nonexistent-codex-verify-test-design-optional-99999.md';

    test('should be registered in ARG_SPEC (source inspection)', async () => {
      const fs = require('fs');
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(source).toContain("'--design-optional'");
      expect(source).toContain("designOptional");
      // Must be a boolean flag (no value needed)
      expect(source).toMatch(/--design-optional.*flag:\s*true/s);
    });

    test('help text includes --design-optional', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);
      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--design-optional']);
    });

    test('doc-review + --design-optional + file absent: SKIP verdict when codex available', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--design', nonExistentDesign,
        '--design-optional'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (parsed.available) {
        // Codex available, file absent, optional flag -> SKIP verdict
        expect(parsed.verdict).toBe('SKIP');
        expect(parsed.doc_review).toBeDefined();
        expect(parsed.doc_review.doc_issues).toEqual([]);
      }
    });

    test('doc-review without --design-optional + file absent: FAIL when codex available (existing behavior preserved)', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--design', nonExistentDesign
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (parsed.available) {
        expect(parsed.verdict).toBe('FAIL');
        expect(parsed.doc_review).toBeDefined();
        expect(parsed.doc_review.doc_issues.length).toBeGreaterThan(0);
      }
    });

    test('full + --design-optional + file absent: doc_review is not in result when codex available', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass',
        '--design', nonExistentDesign,
        '--design-optional'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (parsed.available) {
        // Full mode with optional design file absent -> doc_review skipped entirely
        expect(parsed.doc_review).toBeUndefined();
      }
    });

    test('full without --design-optional + file absent: FAIL when codex available (existing behavior)', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'full',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass',
        '--design', nonExistentDesign
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (parsed.available) {
        expect(parsed.verdict).toBe('FAIL');
        expect(parsed.doc_review).toBeDefined();
      }
    });

    test('--design-optional is accepted as boolean flag (no value needed)', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--design', nonExistentDesign,
        '--design-optional'
      ]);

      // Should not fail with argument parsing error
      expect(result.exitCode).toBe(0);
    });

    test('source code passes designOptional to runCodexDocReview', async () => {
      const fs = require('fs');
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      // Verify runCodexDocReview accepts designOptional parameter
      expect(source).toMatch(/function runCodexDocReview\(.*designOptional/);
      // Verify main passes args.designOptional
      expect(source).toContain('args.designOptional');
    });

    test('runCodexDocReview returns SKIP when file absent and optional (exported function)', () => {
      const codexVerify = require('../../plugins/ultrawork/src/scripts/codex-verify.js');
      // Verify function is exported
      expect(typeof codexVerify.runCodexDocReview).toBe('function');

      const result = codexVerify.runCodexDocReview(
        nonExistentDesign, null, null, [], true
      );
      expect(result.exit_code).toBe(0);
      expect(result.verdict).toBe('SKIP');
      expect(result.doc_issues).toEqual([]);
      expect(result.output).toContain('optional');
    });

    test('runCodexDocReview returns FAIL when file absent and NOT optional (exported function)', () => {
      const codexVerify = require('../../plugins/ultrawork/src/scripts/codex-verify.js');

      const result = codexVerify.runCodexDocReview(
        nonExistentDesign, null, null, [], false
      );
      expect(result.exit_code).toBe(1);
      expect(result.verdict).toBe('FAIL');
      expect(result.doc_issues.length).toBeGreaterThan(0);
    });
  });

  describe('output file pre-cleanup', () => {
    test('main() should delete existing output file before mode execution (source inspection)', () => {
      // Verify the pre-cleanup logic exists in main() before any mode execution
      const fs = require('fs');
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // The pre-cleanup should use fs.unlinkSync to delete the output file
      // before any mode-specific execution begins
      expect(source).toContain('Pre-cleanup');
      expect(source).toMatch(/args\.output.*unlinkSync|unlinkSync.*args\.output/s);
    });

    test('should replace existing output file with new result', async () => {
      const fs = require('fs');
      const outputPath = path.join(session.sessionDir, 'codex-precleanup-test.json');

      // Write old content to the output path
      fs.writeFileSync(outputPath, JSON.stringify({ old: true, stale: 'data' }), 'utf-8');
      expect(fs.existsSync(outputPath)).toBe(true);

      // Run codex-verify with --output pointing to the same file
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check',
        '--output', outputPath
      ]);

      expect(result.exitCode).toBe(0);

      // The file should now contain new result, not old content
      expect(fs.existsSync(outputPath)).toBe(true);
      const newContent = fs.readFileSync(outputPath, 'utf-8');
      const parsed = JSON.parse(newContent);
      expect(parsed.mode).toBe('check');
      expect(parsed.verdict).toBeDefined();
      expect(newContent).not.toContain('stale');
    });

    test('should work fine when output file does not exist yet', async () => {
      const fs = require('fs');
      const outputPath = path.join(session.sessionDir, 'codex-fresh-output.json');

      // Ensure file does not exist
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      expect(fs.existsSync(outputPath)).toBe(false);

      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check',
        '--output', outputPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(outputPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      expect(parsed.mode).toBe('check');
    });

    test('existing output file with invalid content is replaced with valid JSON', async () => {
      const fs = require('fs');
      const outputPath = path.join(session.sessionDir, 'codex-precleanup-verify.json');

      // Write old content
      fs.writeFileSync(outputPath, 'NOT VALID JSON - old garbage', 'utf-8');
      expect(fs.existsSync(outputPath)).toBe(true);

      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check',
        '--output', outputPath
      ]);

      expect(result.exitCode).toBe(0);
      const newContent = fs.readFileSync(outputPath, 'utf-8');
      const parsed = JSON.parse(newContent);
      expect(parsed.mode).toBe('check');
      expect(parsed.verdict).toBeDefined();
    });
  });

  describe('buildVerificationPrompt - Sandbox Constraints', () => {
    // Import the module to test internal functions
    const codexVerify = require('../../plugins/ultrawork/src/scripts/codex-verify.js');

    test('should include Sandbox Constraints section in prompt', () => {
      const criteria = ['Tests pass', 'Code compiles'];
      const prompt = codexVerify.buildVerificationPrompt(criteria);

      expect(prompt).toContain('## Sandbox Constraints (IMPORTANT)');
      expect(prompt).toContain('READ-ONLY sandbox');
      expect(prompt).toContain('EPERM');
      expect(prompt).toContain('EROFS');
    });

    test('should list DO NOT run commands', () => {
      const criteria = ['Tests pass'];
      const prompt = codexVerify.buildVerificationPrompt(criteria);

      expect(prompt).toContain('npm run build');
      expect(prompt).toContain('npm install');
    });

    test('should list read-only alternatives', () => {
      const criteria = ['Tests pass'];
      const prompt = codexVerify.buildVerificationPrompt(criteria);

      expect(prompt).toContain('npx tsc --noEmit');
      expect(prompt).toContain('npx eslint --no-fix');
    });

    test('should include sandbox limitation guidance for EPERM failures', () => {
      const criteria = ['Tests pass'];
      const prompt = codexVerify.buildVerificationPrompt(criteria);

      expect(prompt).toContain('PASS (sandbox limitation)');
    });

    test('should place Sandbox Constraints before criteria list', () => {
      const criteria = ['Tests pass', 'Code compiles'];
      const prompt = codexVerify.buildVerificationPrompt(criteria);

      const sandboxIdx = prompt.indexOf('## Sandbox Constraints');
      const criteriaIdx = prompt.indexOf('Success Criteria:');

      expect(sandboxIdx).toBeGreaterThan(-1);
      expect(criteriaIdx).toBeGreaterThan(-1);
      expect(sandboxIdx).toBeLessThan(criteriaIdx);
    });
  });

  describe('getGitContext', () => {
    const codexVerify = require('../../plugins/ultrawork/src/scripts/codex-verify.js');

    test('should be a function', () => {
      expect(typeof codexVerify.getGitContext).toBe('function');
    });

    test('should return object with diffStat and recentCommits', () => {
      // Use the current project dir which is a git repo
      const result = codexVerify.getGitContext(process.cwd());

      expect(typeof result).toBe('object');
      expect('diffStat' in result).toBe(true);
      expect('recentCommits' in result).toBe(true);
      expect(typeof result.diffStat).toBe('string');
      expect(typeof result.recentCommits).toBe('string');
    });

    test('should return empty strings for non-git directory', () => {
      const result = codexVerify.getGitContext('/tmp');

      expect(result.diffStat).toBe('');
      expect(result.recentCommits).toBe('');
    });

    test('should return recent commits from a git repo', () => {
      // This test runs in a git repo
      const repoRoot = path.resolve(__dirname, '../..');
      const result = codexVerify.getGitContext(repoRoot);

      // Should have some commit output (repo has commits)
      expect(result.recentCommits.length).toBeGreaterThan(0);
    });
  });

  describe('buildVerificationPrompt - Recent Changes (conditional)', () => {
    const codexVerify = require('../../plugins/ultrawork/src/scripts/codex-verify.js');

    test('should include Recent Changes section when gitContext has content', () => {
      const criteria = ['Tests pass'];
      const gitContext = {
        diffStat: ' file1.js | 5 ++---\n file2.js | 10 +++++++---',
        recentCommits: 'abc1234 fix: something\ndef5678 feat: another'
      };
      const prompt = codexVerify.buildVerificationPrompt(criteria, null, null, gitContext);

      expect(prompt).toContain('## Recent Changes');
      expect(prompt).toContain('file1.js');
      expect(prompt).toContain('abc1234');
    });

    test('should NOT include Recent Changes section when gitContext is empty', () => {
      const criteria = ['Tests pass'];
      const gitContext = { diffStat: '', recentCommits: '' };
      const prompt = codexVerify.buildVerificationPrompt(criteria, null, null, gitContext);

      expect(prompt).not.toContain('## Recent Changes');
    });

    test('should NOT include Recent Changes section when gitContext is not provided', () => {
      const criteria = ['Tests pass'];
      const prompt = codexVerify.buildVerificationPrompt(criteria);

      expect(prompt).not.toContain('## Recent Changes');
    });

    test('should include diffStat content in Recent Changes section', () => {
      const criteria = ['Tests pass'];
      const gitContext = {
        diffStat: ' src/app.js | 20 ++++++++++----------',
        recentCommits: ''
      };
      const prompt = codexVerify.buildVerificationPrompt(criteria, null, null, gitContext);

      expect(prompt).toContain('## Recent Changes');
      expect(prompt).toContain('src/app.js');
    });

    test('should include recentCommits content in Recent Changes section', () => {
      const criteria = ['Tests pass'];
      const gitContext = {
        diffStat: '',
        recentCommits: 'abc1234 fix: bug in auth'
      };
      const prompt = codexVerify.buildVerificationPrompt(criteria, null, null, gitContext);

      expect(prompt).toContain('## Recent Changes');
      expect(prompt).toContain('abc1234 fix: bug in auth');
    });
  });

  describe('--sandbox parameter and resolveSandboxMode', () => {
    test('help text includes --sandbox', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--sandbox']);
    });

    test('--sandbox parameter accepted with exec mode', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Test',
        '--sandbox', 'read-only'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('exec');
    });

    test('invalid --sandbox value causes exit 1', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Test',
        '--sandbox', 'invalid-mode'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid sandbox mode');
    });
  });

  describe('buildVerificationPrompt - sandbox mode variations', () => {
    const codexVerify = require('../../plugins/ultrawork/src/scripts/codex-verify.js');

    test('read-only mode includes Sandbox Constraints section', () => {
      const prompt = codexVerify.buildVerificationPrompt(['Test'], null, null, null, 'read-only');

      expect(prompt).toContain('## Sandbox Constraints (IMPORTANT)');
      expect(prompt).toContain('READ-ONLY sandbox');
      expect(prompt).toContain('EPERM');
    });

    test('workspace-write mode includes Sandbox Info instead of Constraints', () => {
      const prompt = codexVerify.buildVerificationPrompt(['Test'], null, null, null, 'workspace-write');

      expect(prompt).not.toContain('## Sandbox Constraints (IMPORTANT)');
      expect(prompt).not.toContain('READ-ONLY sandbox');
      expect(prompt).toContain('## Sandbox Info');
      expect(prompt).toContain('workspace-write sandbox');
    });

    test('default (no sandboxMode) uses read-only behavior', () => {
      const prompt = codexVerify.buildVerificationPrompt(['Test']);

      expect(prompt).toContain('## Sandbox Constraints (IMPORTANT)');
    });
  });

  describe('buildDocReviewPrompt', () => {
    const codexVerify = require('../../plugins/ultrawork/src/scripts/codex-verify.js');
    const fs = require('fs');
    const os = require('os');

    let tmpDesign;

    beforeEach(() => {
      tmpDesign = path.join(os.tmpdir(), `codex-test-design-${Date.now()}.md`);
      fs.writeFileSync(tmpDesign, '# Design\n\n## Overview\nSample design doc content.\n', 'utf-8');
    });

    afterEach(() => {
      if (fs.existsSync(tmpDesign)) fs.unlinkSync(tmpDesign);
    });

    test('buildDocReviewPrompt is exported', () => {
      expect(typeof codexVerify.buildDocReviewPrompt).toBe('function');
    });

    // --- Alignment-based criteria ---

    test('prompt contains Context Sufficiency criterion', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).toContain('Context Sufficiency');
    });

    test('prompt contains Goal-Result Alignment criterion', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).toContain('Goal-Result Alignment');
    });

    test('prompt contains Blocked Patterns criterion', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).toContain('Blocked Patterns');
    });

    test('prompt does NOT contain old Structural Accuracy criterion', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).not.toContain('Structural Accuracy');
    });

    test('prompt does NOT contain old Internal Consistency criterion', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).not.toContain('Internal Consistency');
    });

    test('prompt does NOT contain old Quality criterion as a numbered item', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      // Old criterion 4 was "Quality" - should be removed
      expect(prompt).not.toMatch(/\d+\.\s+\*\*Quality\*\*/);
    });

    test('category enum uses new values: context_sufficiency, goal_alignment, blocked_pattern', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).toContain('context_sufficiency');
      expect(prompt).toContain('goal_alignment');
      expect(prompt).toContain('blocked_pattern');
    });

    test('category enum does NOT use old values: completeness, consistency, quality', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      // The category enum in the JSON output format should not use old values
      expect(prompt).not.toMatch(/category.*completeness/);
      expect(prompt).not.toMatch(/category.*consistency/);
      expect(prompt).not.toMatch(/category.*quality/);
    });

    test('JSON output format preserved: doc_issues array with category/severity/detail', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).toContain('doc_issues');
      expect(prompt).toContain('category');
      expect(prompt).toContain('severity');
      expect(prompt).toContain('detail');
      expect(prompt).toContain('overall_verdict');
      expect(prompt).toContain('summary');
      expect(prompt).toContain('PASS|FAIL');
    });

    test('Context Sufficiency describes AI worker implementation context', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      // Should mention AI worker can implement using only the document
      expect(prompt).toContain('implement');
      expect(prompt).toContain('missing context');
    });

    test('Context Sufficiency has IGNORE clause for implementation concerns', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).toContain('tool permissions');
      expect(prompt).toContain('JSON field names');
      expect(prompt).toContain('implementation concerns');
    });

    test('Goal-Result Alignment describes chain from Goal to Results', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).toContain('problem statement');
      expect(prompt).toContain('approach');
      expect(prompt).toContain('changed files');
      expect(prompt).toContain('verification criteria');
      expect(prompt).toContain('broken chains');
    });

    test('Blocked Patterns includes vague statement detection', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      // Blocked Patterns now also covers what was "Quality" criterion
      expect(prompt).toContain('should work');
      expect(prompt).toContain('probably');
      expect(prompt).toContain('maybe');
    });

    test('prompt includes design document content', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      expect(prompt).toContain('Sample design doc content');
    });

    test('prompt includes goal when provided', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign, 'Build a marketplace');

      expect(prompt).toContain('Build a marketplace');
    });

    test('exactly 3 numbered criteria (not 4)', () => {
      const prompt = codexVerify.buildDocReviewPrompt(tmpDesign);

      // Count numbered criteria patterns like "1. **...**"
      const criteriaMatches = prompt.match(/\d+\.\s+\*\*/g);
      expect(criteriaMatches).not.toBeNull();
      expect(criteriaMatches.length).toBe(3);
    });
  });

  describe('parseDocReviewOutput - new category handling', () => {
    const codexVerify = require('../../plugins/ultrawork/src/scripts/codex-verify.js');

    test('parseDocReviewOutput handles new category values correctly', () => {
      const output = JSON.stringify({
        doc_issues: [
          { category: 'context_sufficiency', severity: 'error', detail: 'Missing API schema' },
          { category: 'goal_alignment', severity: 'warning', detail: 'Weak chain from goal to files' },
          { category: 'blocked_pattern', severity: 'error', detail: 'Found TODO in section 3' }
        ],
        overall_verdict: 'FAIL',
        summary: 'Issues found'
      });

      const result = codexVerify.parseDocReviewOutput(output);

      expect(result.doc_issues.length).toBe(3);
      expect(result.doc_issues[0].category).toBe('context_sufficiency');
      expect(result.doc_issues[1].category).toBe('goal_alignment');
      expect(result.doc_issues[2].category).toBe('blocked_pattern');
      expect(result.verdict).toBe('FAIL');
    });

    test('parseDocReviewOutput default fallback uses context_sufficiency category', () => {
      const result = codexVerify.parseDocReviewOutput('not valid json at all');

      expect(result.doc_issues.length).toBe(1);
      expect(result.doc_issues[0].category).toBe('context_sufficiency');
      expect(result.verdict).toBe('FAIL');
    });
  });
});
