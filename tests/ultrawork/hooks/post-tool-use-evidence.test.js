#!/usr/bin/env bun
/**
 * Tests for post-tool-use-evidence.js - JSONL evidence format validation
 *
 * Tests the evidence building functions and JSONL log format:
 * - Single evidence entry produces parseable JSON line
 * - Multiple entries each parse independently
 * - Evidence structures have required fields (type, timestamp)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, test, expect, beforeEach, afterAll } = require('bun:test');

// Set test base dir BEFORE importing session-utils
const TEST_BASE_DIR = path.join(os.tmpdir(), 'ultrawork-test-evidence');
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR;

const {
  buildBashEvidence,
  buildFileEvidence,
  truncateOutput,
  isTestCommand,
} = require('../../../plugins/ultrawork/src/hooks/post-tool-use-evidence.js');

// Cleanup
afterAll(() => {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
  delete process.env.ULTRAWORK_TEST_BASE_DIR;
});

beforeEach(() => {
  if (fs.existsSync(TEST_BASE_DIR)) {
    fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  }
});

describe('post-tool-use-evidence.js - JSONL format validation', () => {
  describe('buildBashEvidence', () => {
    test('produces evidence with required fields (type, timestamp)', () => {
      const evidence = buildBashEvidence('ls -la', 'file1.txt\nfile2.txt', 0);

      expect(evidence).toHaveProperty('type');
      expect(evidence).toHaveProperty('timestamp');
      expect(evidence.type).toBe('command_execution');
      expect(typeof evidence.timestamp).toBe('string');
      // Verify ISO 8601 timestamp format
      expect(new Date(evidence.timestamp).toISOString()).toBe(evidence.timestamp);
    });

    test('command evidence includes command and exit_code', () => {
      const evidence = buildBashEvidence('git status', 'On branch main', 0);

      expect(evidence.type).toBe('command_execution');
      expect(evidence.command).toBe('git status');
      expect(evidence.exit_code).toBe(0);
      expect(evidence.output_preview).toContain('On branch main');
    });

    test('test command produces test_result type', () => {
      const evidence = buildBashEvidence(
        'npm test',
        'Tests: 5 passed, 5 total',
        0
      );

      expect(evidence.type).toBe('test_result');
      expect(evidence.passed).toBe(true);
      expect(evidence.framework).toBe('jest');
    });

    test('failed test command sets passed=false', () => {
      const evidence = buildBashEvidence(
        'npm test',
        'Tests: 3 passed, 2 failed, 5 total',
        1
      );

      expect(evidence.type).toBe('test_result');
      expect(evidence.passed).toBe(false);
    });
  });

  describe('buildFileEvidence', () => {
    test('produces file_operation evidence with required fields', () => {
      const evidence = buildFileEvidence('write', '/src/app.ts');

      expect(evidence.type).toBe('file_operation');
      expect(evidence).toHaveProperty('timestamp');
      expect(evidence.operation).toBe('write');
      expect(evidence.path).toBe('/src/app.ts');
    });

    test('edit operation type', () => {
      const evidence = buildFileEvidence('edit', '/src/utils.ts');

      expect(evidence.operation).toBe('edit');
      expect(evidence.path).toBe('/src/utils.ts');
    });
  });

  describe('JSONL format - single entry', () => {
    test('single evidence entry serializes to valid JSON line', () => {
      const evidence = buildBashEvidence('echo hello', 'hello', 0);
      const line = JSON.stringify(evidence);

      // Verify it parses back correctly
      const parsed = JSON.parse(line);
      expect(parsed.type).toBe('command_execution');
      expect(parsed.timestamp).toBe(evidence.timestamp);

      // Verify it is a single line (no embedded newlines)
      expect(line.includes('\n')).toBe(false);
    });
  });

  describe('JSONL format - multiple entries', () => {
    test('5 entries each parse independently as JSON lines', () => {
      const entries = [
        buildBashEvidence('ls', 'file1', 0),
        buildFileEvidence('write', '/src/a.ts'),
        buildBashEvidence('npm test', 'Tests: 3 passed', 0),
        buildFileEvidence('edit', '/src/b.ts'),
        buildBashEvidence('git status', 'clean', 0),
      ];

      // Simulate JSONL format (one JSON object per line)
      const jsonlContent = entries.map(e => JSON.stringify(e)).join('\n') + '\n';

      // Parse each line independently
      const lines = jsonlContent.trim().split('\n');
      expect(lines.length).toBe(5);

      for (let i = 0; i < lines.length; i++) {
        const parsed = JSON.parse(lines[i]);
        expect(parsed).toHaveProperty('type');
        expect(parsed).toHaveProperty('timestamp');
      }

      // Verify types are correct
      expect(JSON.parse(lines[0]).type).toBe('command_execution');
      expect(JSON.parse(lines[1]).type).toBe('file_operation');
      expect(JSON.parse(lines[2]).type).toBe('test_result');
      expect(JSON.parse(lines[3]).type).toBe('file_operation');
      expect(JSON.parse(lines[4]).type).toBe('command_execution');
    });
  });

  describe('isTestCommand', () => {
    test('detects npm test', () => {
      expect(isTestCommand('npm test')).toBe(true);
      expect(isTestCommand('npm run test')).toBe(true);
    });

    test('detects vitest', () => {
      expect(isTestCommand('vitest')).toBe(true);
    });

    test('detects pytest', () => {
      expect(isTestCommand('pytest tests/')).toBe(true);
    });

    test('does not match regular commands', () => {
      expect(isTestCommand('ls -la')).toBe(false);
      expect(isTestCommand('git status')).toBe(false);
    });
  });

  describe('truncateOutput', () => {
    test('returns short text unchanged', () => {
      expect(truncateOutput('short text')).toBe('short text');
    });

    test('truncates text longer than maxLen', () => {
      const longText = 'x'.repeat(3000);
      const result = truncateOutput(longText, 2000);

      expect(result.length).toBeLessThan(3000);
      expect(result).toContain('[truncated');
    });
  });
});
