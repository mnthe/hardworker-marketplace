#!/usr/bin/env bun
/**
 * Tests for args.js
 * Tests argument parsing and help generation
 */

const { test, expect, describe } = require('bun:test');
const { parseArgs, generateHelp } = require('../../../plugins/teamwork/src/lib/args.js');

describe('parseArgs', () => {
  test('parses basic arguments', () => {
    const spec = {
      '--project': { key: 'project' },
      '--team': { key: 'team' }
    };
    const argv = ['node', 'script.js', '--project', 'my-project', '--team', 'my-team'];
    const result = parseArgs(spec, argv);

    expect(result.project).toBe('my-project');
    expect(result.team).toBe('my-team');
  });

  test('handles aliases', () => {
    const spec = {
      '--project': { key: 'project', aliases: ['-p'] },
      '--team': { key: 'team', aliases: ['-t'] }
    };
    const argv = ['node', 'script.js', '-p', 'my-project', '-t', 'my-team'];
    const result = parseArgs(spec, argv);

    expect(result.project).toBe('my-project');
    expect(result.team).toBe('my-team');
  });

  test('applies default values', () => {
    const spec = {
      '--format': { key: 'format', default: 'table' },
      '--verbose': { key: 'verbose', default: false }
    };
    const argv = ['node', 'script.js'];
    const result = parseArgs(spec, argv);

    expect(result.format).toBe('table');
    expect(result.verbose).toBe(false);
  });

  test('handles boolean flags', () => {
    const spec = {
      '--verbose': { key: 'verbose', flag: true },
      '--help': { key: 'help', flag: true }
    };
    const argv = ['node', 'script.js', '--verbose'];
    const result = parseArgs(spec, argv);

    expect(result.verbose).toBe(true);
    expect(result.help).toBe(false);
  });

  test('validates required arguments', () => {
    const spec = {
      '--project': { key: 'project', required: true }
    };
    const argv = ['node', 'script.js'];

    // Mock console.error and process.exit
    const originalError = console.error;
    const originalExit = process.exit;
    let errorMessage = '';
    let exitCode = -1;

    console.error = (msg) => { errorMessage = msg; };
    process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };

    try {
      parseArgs(spec, argv);
    } catch (e) {
      // Expected to throw
    }

    console.error = originalError;
    process.exit = originalExit;

    expect(errorMessage).toContain('--project');
    expect(errorMessage).toContain('required');
    expect(exitCode).toBe(1);
  });

  test('handles multiple aliases', () => {
    const spec = {
      '--project': { key: 'project', aliases: ['-p', '--proj'] }
    };
    const argv1 = ['node', 'script.js', '-p', 'test'];
    const argv2 = ['node', 'script.js', '--proj', 'test'];

    const result1 = parseArgs(spec, argv1);
    const result2 = parseArgs(spec, argv2);

    expect(result1.project).toBe('test');
    expect(result2.project).toBe('test');
  });

  test('ignores unknown arguments', () => {
    const spec = {
      '--project': { key: 'project' }
    };
    const argv = ['node', 'script.js', '--project', 'test', '--unknown', 'value'];
    const result = parseArgs(spec, argv);

    expect(result.project).toBe('test');
    expect(result.unknown).toBeUndefined();
  });
});

describe('generateHelp', () => {
  test('generates basic help text', () => {
    const spec = {
      '--project': { key: 'project', required: true },
      '--format': { key: 'format', default: 'table' }
    };
    const help = generateHelp('test-script', spec);

    expect(help).toContain('Usage: test-script [options]');
    expect(help).toContain('--project');
    expect(help).toContain('(required)');
    expect(help).toContain('--format');
    expect(help).toContain('[default: table]');
  });

  test('includes description when provided', () => {
    const spec = {
      '--project': { key: 'project' }
    };
    const help = generateHelp('test-script', spec, 'Test script description');

    expect(help).toContain('Test script description');
  });

  test('shows aliases in help text', () => {
    const spec = {
      '--project': { key: 'project', aliases: ['-p', '--proj'] }
    };
    const help = generateHelp('test-script', spec);

    expect(help).toContain('-p');
    expect(help).toContain('--proj');
  });

  test('marks flag arguments correctly', () => {
    const spec = {
      '--verbose': { key: 'verbose', flag: true }
    };
    const help = generateHelp('test-script', spec);

    expect(help).toContain('--verbose');
    expect(help).not.toContain('<value>');
  });

  test('shows value placeholder for non-flag arguments', () => {
    const spec = {
      '--project': { key: 'project' }
    };
    const help = generateHelp('test-script', spec);

    expect(help).toContain('<value>');
  });
});
