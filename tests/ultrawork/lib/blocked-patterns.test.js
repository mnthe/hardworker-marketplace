#!/usr/bin/env bun
/**
 * Tests for blocked-patterns.js - Blocked pattern detection
 */

const { describe, test, expect } = require('bun:test');
const {
  BLOCKED_PATTERNS,
  scanForBlockedPatterns,
  shouldBlockCompletion
} = require('../../../plugins/ultrawork/src/lib/blocked-patterns.js');

describe('blocked-patterns.js', () => {
  describe('BLOCKED_PATTERNS', () => {
    test('should be a non-empty array', () => {
      expect(Array.isArray(BLOCKED_PATTERNS)).toBe(true);
      expect(BLOCKED_PATTERNS.length).toBeGreaterThan(0);
    });

    test('each pattern should have regex, severity, and message', () => {
      for (const pattern of BLOCKED_PATTERNS) {
        expect(pattern.regex).toBeInstanceOf(RegExp);
        expect(typeof pattern.severity).toBe('string');
        expect(typeof pattern.message).toBe('string');
      }
    });

    test('should contain both error and warning severities', () => {
      const severities = new Set(BLOCKED_PATTERNS.map(p => p.severity));
      expect(severities.has('error')).toBe(true);
      expect(severities.has('warning')).toBe(true);
    });
  });

  describe('scanForBlockedPatterns', () => {
    test('should return empty array for clean text', () => {
      const result = scanForBlockedPatterns('All tests pass with exit code 0');
      expect(result).toEqual([]);
    });

    test('should return empty array for null/undefined input', () => {
      expect(scanForBlockedPatterns(null)).toEqual([]);
      expect(scanForBlockedPatterns(undefined)).toEqual([]);
      expect(scanForBlockedPatterns('')).toEqual([]);
    });

    test('should return empty array for non-string input', () => {
      expect(scanForBlockedPatterns(123)).toEqual([]);
      expect(scanForBlockedPatterns({})).toEqual([]);
    });

    test('should detect "should work" pattern', () => {
      const result = scanForBlockedPatterns('This should work fine');
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('error');
      expect(result[0].match).toBe('should work');
    });

    test('should detect "TODO" pattern', () => {
      const result = scanForBlockedPatterns('TODO: implement this later');
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('error');
    });

    test('should detect "FIXME" pattern', () => {
      const result = scanForBlockedPatterns('FIXME: broken edge case');
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('error');
    });

    test('should detect warning-level patterns', () => {
      const result = scanForBlockedPatterns('This is a WIP feature');
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('warning');
    });

    test('should detect multiple patterns in same text', () => {
      const result = scanForBlockedPatterns('TODO: this should work, it is a placeholder');
      expect(result.length).toBe(3); // TODO + should work + placeholder
    });

    test('should be case-insensitive', () => {
      const result = scanForBlockedPatterns('todo: fix this');
      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('error');
    });

    test('should include match details', () => {
      const result = scanForBlockedPatterns('not implemented yet');
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('pattern');
      expect(result[0]).toHaveProperty('severity');
      expect(result[0]).toHaveProperty('message');
      expect(result[0]).toHaveProperty('match');
    });
  });

  describe('shouldBlockCompletion', () => {
    test('should return true when error-severity matches exist', () => {
      const matches = [{ severity: 'error', pattern: 'test', message: 'test', match: 'test' }];
      expect(shouldBlockCompletion(matches)).toBe(true);
    });

    test('should return false when only warning-severity matches exist', () => {
      const matches = [{ severity: 'warning', pattern: 'test', message: 'test', match: 'test' }];
      expect(shouldBlockCompletion(matches)).toBe(false);
    });

    test('should return false for empty matches array', () => {
      expect(shouldBlockCompletion([])).toBe(false);
    });

    test('should return true if any match is error among mixed severities', () => {
      const matches = [
        { severity: 'warning', pattern: 'w', message: 'w', match: 'w' },
        { severity: 'error', pattern: 'e', message: 'e', match: 'e' }
      ];
      expect(shouldBlockCompletion(matches)).toBe(true);
    });
  });
});
