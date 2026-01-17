#!/usr/bin/env bun
/**
 * Tests for types.js
 * Verifies that the types module exports correctly
 */

const { test, expect } = require('bun:test');
const types = require('../../../plugins/teamwork/src/lib/types.js');

test('types.js exports an object', () => {
  expect(types).toBeDefined();
  expect(typeof types).toBe('object');
});

test('types.js exports empty object (only JSDoc types)', () => {
  // types.js only contains JSDoc type definitions, no runtime exports
  expect(Object.keys(types).length).toBe(0);
});
