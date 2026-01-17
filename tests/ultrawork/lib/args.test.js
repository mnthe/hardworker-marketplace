#!/usr/bin/env bun
/**
 * Tests for args.js - Argument parsing utilities
 */

const { describe, test, expect } = require('bun:test');
const { parseArgs, generateHelp } = require('../../../plugins/ultrawork/src/lib/args.js');

describe('args.js', () => {
  describe('parseArgs', () => {
    test('should parse basic arguments', () => {
      const spec = {
        '--session': { key: 'session', required: true },
        '--task': { key: 'taskId' }
      };
      const argv = ['node', 'script.js', '--session', 'abc-123', '--task', '1'];

      const result = parseArgs(spec, argv);

      expect(result.session).toBe('abc-123');
      expect(result.taskId).toBe('1');
    });

    test('should handle aliases', () => {
      const spec = {
        '--session': { key: 'session', aliases: ['-s'], required: true }
      };
      const argv = ['node', 'script.js', '-s', 'test-session'];

      const result = parseArgs(spec, argv);

      expect(result.session).toBe('test-session');
    });

    test('should set default values', () => {
      const spec = {
        '--format': { key: 'format', default: 'table' },
        '--limit': { key: 'limit', default: 10 }
      };
      const argv = ['node', 'script.js'];

      const result = parseArgs(spec, argv);

      expect(result.format).toBe('table');
      expect(result.limit).toBe(10);
    });

    test('should handle boolean flags', () => {
      const spec = {
        '--verbose': { key: 'verbose', flag: true },
        '--quiet': { key: 'quiet', flag: true }
      };
      const argv = ['node', 'script.js', '--verbose'];

      const result = parseArgs(spec, argv);

      expect(result.verbose).toBe(true);
      expect(result.quiet).toBe(false);
    });

    test('should exit on missing required arguments', () => {
      const spec = {
        '--session': { key: 'session', required: true }
      };
      const argv = ['node', 'script.js'];

      // Mock process.exit and console.error
      const originalExit = process.exit;
      const originalError = console.error;
      let exitCode = null;
      let errorMessage = '';

      process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
      console.error = (msg) => { errorMessage = msg; };

      try {
        parseArgs(spec, argv);
      } catch (e) {
        // Expected to throw
      }

      // Restore originals
      process.exit = originalExit;
      console.error = originalError;

      expect(exitCode).toBe(1);
      expect(errorMessage).toContain('--session');
      expect(errorMessage).toContain('required');
    });

    test('should handle multiple aliases', () => {
      const spec = {
        '--task': { key: 'taskId', aliases: ['-t', '--id'], required: true }
      };

      // Test first alias
      const argv1 = ['node', 'script.js', '-t', '1'];
      const result1 = parseArgs(spec, argv1);
      expect(result1.taskId).toBe('1');

      // Test second alias
      const argv2 = ['node', 'script.js', '--id', '2'];
      const result2 = parseArgs(spec, argv2);
      expect(result2.taskId).toBe('2');
    });

    test('should ignore unknown flags', () => {
      const spec = {
        '--session': { key: 'session', required: true }
      };
      const argv = ['node', 'script.js', '--session', 'abc', '--unknown', 'value'];

      const result = parseArgs(spec, argv);

      expect(result.session).toBe('abc');
      expect(result.unknown).toBeUndefined();
    });

    test('should override defaults with provided values', () => {
      const spec = {
        '--format': { key: 'format', default: 'table' }
      };
      const argv = ['node', 'script.js', '--format', 'json'];

      const result = parseArgs(spec, argv);

      expect(result.format).toBe('json');
    });
  });

  describe('generateHelp', () => {
    test('should generate basic help text', () => {
      const spec = {
        '--session': { key: 'session', aliases: ['-s'], required: true },
        '--format': { key: 'format', default: 'table' }
      };

      const help = generateHelp('test-script.js', spec, 'A test script');

      expect(help).toContain('Usage: test-script.js');
      expect(help).toContain('A test script');
      expect(help).toContain('--session');
      expect(help).toContain('-s');
      expect(help).toContain('(required)');
      expect(help).toContain('[default: table]');
    });

    test('should show flags without value placeholder', () => {
      const spec = {
        '--verbose': { key: 'verbose', flag: true }
      };

      const help = generateHelp('test-script.js', spec);

      expect(help).toContain('--verbose');
      expect(help).not.toContain('<value>');
    });

    test('should show value placeholder for non-flags', () => {
      const spec = {
        '--session': { key: 'session', required: true }
      };

      const help = generateHelp('test-script.js', spec);

      expect(help).toContain('--session <value>');
    });

    test('should work without description', () => {
      const spec = {
        '--test': { key: 'test' }
      };

      const help = generateHelp('test-script.js', spec);

      expect(help).toContain('Usage: test-script.js');
      expect(help).toContain('Options:');
      expect(help).toContain('--test');
    });
  });
});
