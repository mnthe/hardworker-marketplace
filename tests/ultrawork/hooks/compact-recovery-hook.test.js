#!/usr/bin/env bun
/**
 * Tests for compact-recovery-hook.js - Task ID sorting
 */

const { describe, test, expect } = require('bun:test');
const { compareTaskIds } = require('../../../plugins/ultrawork/src/hooks/compact-recovery-hook.js');

describe('compact-recovery-hook.js', () => {
  describe('compareTaskIds', () => {
    test('should sort numeric IDs numerically', () => {
      const ids = ['3', '1', '10', '2'];
      const sorted = ids.sort(compareTaskIds);

      expect(sorted).toEqual(['1', '2', '3', '10']);
    });

    test('should place numeric IDs before non-numeric IDs', () => {
      const ids = ['verify', '1', 'cleanup', '2'];
      const sorted = ids.sort(compareTaskIds);

      expect(sorted).toEqual(['1', '2', 'cleanup', 'verify']);
    });

    test('should sort non-numeric IDs alphabetically', () => {
      const ids = ['verify', 'cleanup', 'alpha'];
      const sorted = ids.sort(compareTaskIds);

      expect(sorted).toEqual(['alpha', 'cleanup', 'verify']);
    });

    test('should handle mixed numeric and non-numeric IDs', () => {
      const ids = ['verify', '3', '1', 'cleanup', '10', '2'];
      const sorted = ids.sort(compareTaskIds);

      expect(sorted).toEqual(['1', '2', '3', '10', 'cleanup', 'verify']);
    });

    test('should handle single element array', () => {
      const ids = ['1'];
      const sorted = ids.sort(compareTaskIds);

      expect(sorted).toEqual(['1']);
    });

    test('should handle empty array', () => {
      const ids = [];
      const sorted = ids.sort(compareTaskIds);

      expect(sorted).toEqual([]);
    });

    test('should handle IDs that look numeric but are not pure numbers', () => {
      // '1a' is not purely numeric (parseInt returns 1 but String(1) !== '1a')
      const ids = ['1a', '2', '1', '2b'];
      const sorted = ids.sort(compareTaskIds);

      expect(sorted).toEqual(['1', '2', '1a', '2b']);
    });

    test('should handle leading zeros correctly', () => {
      // '01' is not purely numeric (parseInt returns 1 but String(1) !== '01')
      const ids = ['01', '1', '2', '02'];
      const sorted = ids.sort(compareTaskIds);

      expect(sorted).toEqual(['1', '2', '01', '02']);
    });

    test('should correctly compare two numeric IDs', () => {
      expect(compareTaskIds('1', '2')).toBeLessThan(0);
      expect(compareTaskIds('2', '1')).toBeGreaterThan(0);
      expect(compareTaskIds('10', '2')).toBeGreaterThan(0);
      expect(compareTaskIds('1', '1')).toBe(0);
    });

    test('should correctly compare numeric vs non-numeric', () => {
      expect(compareTaskIds('1', 'verify')).toBeLessThan(0);
      expect(compareTaskIds('verify', '1')).toBeGreaterThan(0);
    });

    test('should correctly compare two non-numeric IDs', () => {
      expect(compareTaskIds('alpha', 'beta')).toBeLessThan(0);
      expect(compareTaskIds('beta', 'alpha')).toBeGreaterThan(0);
      expect(compareTaskIds('verify', 'verify')).toBe(0);
    });
  });
});
