#!/usr/bin/env bun
/**
 * Tests for hook-utils.js
 * Tests hook utility functions
 */

const { test, expect, describe } = require('bun:test');
const {
  safeJsonParse,
  extractTextContent,
  hasStdin
} = require('../../../plugins/teamwork/src/lib/hook-utils.js');

describe('safeJsonParse', () => {
  test('parses valid JSON', () => {
    const json = '{"key": "value"}';
    const result = safeJsonParse(json);

    expect(result).toEqual({ key: 'value' });
  });

  test('returns fallback for invalid JSON', () => {
    const invalid = 'not json';
    const result = safeJsonParse(invalid);

    expect(result).toEqual({});
  });

  test('uses custom fallback', () => {
    const invalid = 'not json';
    const fallback = { default: 'value' };
    const result = safeJsonParse(invalid, fallback);

    expect(result).toEqual(fallback);
  });

  test('handles empty string', () => {
    const result = safeJsonParse('');

    expect(result).toEqual({});
  });

  test('handles null input', () => {
    const result = safeJsonParse(null);

    // JSON.parse(null) is valid and returns null
    expect(result).toBe(null);
  });

  test('handles complex JSON objects', () => {
    const json = JSON.stringify({
      nested: { key: 'value' },
      array: [1, 2, 3],
      boolean: true
    });
    const result = safeJsonParse(json);

    expect(result).toEqual({
      nested: { key: 'value' },
      array: [1, 2, 3],
      boolean: true
    });
  });
});

describe('extractTextContent', () => {
  test('extracts transcript field', () => {
    const hookInput = {
      transcript: 'transcript content',
      output: 'output content'
    };
    const result = extractTextContent(hookInput, 'raw input');

    expect(result).toBe('transcript content');
  });

  test('falls back to output field', () => {
    const hookInput = {
      output: 'output content'
    };
    const result = extractTextContent(hookInput, 'raw input');

    expect(result).toBe('output content');
  });

  test('falls back to raw input', () => {
    const hookInput = {};
    const result = extractTextContent(hookInput, 'raw input');

    expect(result).toBe('raw input');
  });

  test('prefers transcript over output', () => {
    const hookInput = {
      transcript: 'transcript content',
      output: 'output content'
    };
    const result = extractTextContent(hookInput, 'raw input');

    expect(result).toBe('transcript content');
  });

  test('handles empty object hook input', () => {
    const result = extractTextContent({}, 'raw input');

    expect(result).toBe('raw input');
  });

  test('handles empty strings in fields', () => {
    const hookInput = {
      transcript: '',
      output: 'output content'
    };
    const result = extractTextContent(hookInput, 'raw input');

    // Empty string is falsy, so falls back to output
    expect(result).toBe('output content');
  });
});

describe('hasStdin', () => {
  test('returns boolean', () => {
    const result = hasStdin();

    expect(typeof result).toBe('boolean');
  });

  test('returns true when stdin is not TTY', () => {
    // In test environment, stdin.isTTY is usually undefined or false
    const result = hasStdin();

    // Should be true since we're in a test environment (not interactive TTY)
    expect(result).toBe(!process.stdin.isTTY);
  });
});
