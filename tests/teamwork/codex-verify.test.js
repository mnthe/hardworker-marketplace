#!/usr/bin/env bun
/**
 * Tests for teamwork codex-verify.js
 *
 * Covers --enable parameter support and graceful degradation
 * when codex CLI is not installed.
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { createMockProject, runScript, assertHelpText } = require('./test-utils.js');
const path = require('path');
const fs = require('fs');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/codex-verify.js');

describe('codex-verify.js', () => {
  let project;

  beforeEach(() => {
    project = createMockProject('test-codex', 'test-team');
  });

  afterEach(() => {
    project.cleanup();
  });

  describe('help flag', () => {
    test('should display help with --help', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      assertHelpText(result.stdout, ['--mode', '--working-dir', '--criteria']);
    });

    test('should include --enable in help output', async () => {
      const result = await runScript(SCRIPT_PATH, ['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--enable');
    });
  });

  describe('--mode check', () => {
    test('should exit 0 with valid JSON', async () => {
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
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      if (!parsed.available) {
        expect(parsed.verdict).toBe('SKIP');
      }
    });
  });

  describe('--enable parameter', () => {
    test('should accept --enable flag without error', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check',
        '--enable', 'feature1,feature2'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('check');
    });

    test('should accept -e alias without error', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check',
        '-e', 'feature1'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('check');
    });

    test('should work with exec mode and enable features', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'exec',
        '--working-dir', '/tmp/test-project',
        '--criteria', 'Tests pass|Code compiles',
        '--enable', 'feature1,feature2'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('exec');
      expect(parsed.verdict).toBeDefined();
    });

    test('should work with doc-review mode and enable features', async () => {
      const nonExistentDesign = '/tmp/nonexistent-codex-verify-test-design-99999.md';
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'doc-review',
        '--design', nonExistentDesign,
        '--enable', 'feature1'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.mode).toBe('doc-review');
      expect(parsed.verdict).toBeDefined();
    });
  });

  describe('ARG_SPEC --enable entry', () => {
    test('should have enableFeatures key in ARG_SPEC', async () => {
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(source).toContain("'--enable'");
      expect(source).toContain("enableFeatures");
    });
  });

  describe('collab always enabled', () => {
    test('DEFAULT_ENABLE_FEATURES includes collab', async () => {
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(source).toContain("DEFAULT_ENABLE_FEATURES = ['collab']");
    });

    test('user features are merged with defaults, not replacing', async () => {
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(source).toContain('...DEFAULT_ENABLE_FEATURES');
    });
  });

  describe('runCodexExec enableFeatures parameter', () => {
    test('should have enableFeatures parameter in function signature', async () => {
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      // Check that runCodexExec function accepts enableFeatures
      const execFnMatch = source.match(/function runCodexExec\([^)]*\)/);
      expect(execFnMatch).not.toBeNull();
      expect(execFnMatch[0]).toContain('enableFeatures');
    });

    test('should inject --enable flags into args array', async () => {
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      // Verify the pattern for injecting --enable feature pairs before -m
      expect(source).toContain("'--enable'");
      // Look for the forEach/loop that injects enable features into args
      expect(source).toMatch(/enableFeatures.*forEach|for.*enableFeatures/);
    });
  });

  describe('runCodexDocReview enableFeatures parameter', () => {
    test('should have enableFeatures parameter in function signature', async () => {
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      // Check that runCodexDocReview function accepts enableFeatures
      const docFnMatch = source.match(/function runCodexDocReview\([^)]*\)/);
      expect(docFnMatch).not.toBeNull();
      expect(docFnMatch[0]).toContain('enableFeatures');
    });

    test('should inject --enable flags into doc review args array', async () => {
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      // Verify there are two separate injection points (exec and doc-review)
      const enableInjections = source.match(/for\s+\(const\s+\w+\s+of\s+enableFeatures\)|enableFeatures\.forEach/g);
      expect(enableInjections).not.toBeNull();
      expect(enableInjections.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('CliArgs typedef', () => {
    test('should include enableFeatures in CliArgs typedef', async () => {
      const source = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(source).toContain('enableFeatures');
      // Verify it is in the typedef block
      const typedefMatch = source.match(/@typedef\s+\{Object\}\s+CliArgs[\s\S]*?\*\//);
      expect(typedefMatch).not.toBeNull();
      expect(typedefMatch[0]).toContain('enableFeatures');
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

  describe('JSON output structure', () => {
    test('should always include available, mode, verdict, summary fields', async () => {
      const result = await runScript(SCRIPT_PATH, [
        '--mode', 'check'
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect('available' in parsed).toBe(true);
      expect('mode' in parsed).toBe(true);
      expect('verdict' in parsed).toBe(true);
      expect('summary' in parsed).toBe(true);
    });
  });
});
