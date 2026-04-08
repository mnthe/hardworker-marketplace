#!/usr/bin/env bun
/**
 * Tests for json-ops.js - Atomic JSON file operations
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { readJsonSafe, writeJsonAtomically } = require('../../../plugins/ultrawork/src/lib/json-ops.js');
const { createTempDir } = require('../../test-utils.js');
const fs = require('fs');
const path = require('path');

describe('json-ops.js', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir('json-ops-test-');
  });

  afterEach(() => {
    tempDir.cleanup();
  });

  describe('readJsonSafe', () => {
    test('should read valid JSON file', () => {
      const filePath = path.join(tempDir.path, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify({ key: 'value' }), 'utf-8');

      const result = readJsonSafe(filePath);
      expect(result).toEqual({ key: 'value' });
    });

    test('should return null for non-existent file', () => {
      const result = readJsonSafe(path.join(tempDir.path, 'missing.json'));
      expect(result).toBeNull();
    });

    test('should return null for invalid JSON', () => {
      const filePath = path.join(tempDir.path, 'bad.json');
      fs.writeFileSync(filePath, 'not json', 'utf-8');

      const result = readJsonSafe(filePath);
      expect(result).toBeNull();
    });
  });

  describe('writeJsonAtomically', () => {
    test('should write JSON data to file', () => {
      const filePath = path.join(tempDir.path, 'output.json');
      const data = { hello: 'world', count: 42 };

      writeJsonAtomically(filePath, data);

      const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(written).toEqual(data);
    });

    test('should use PID+timestamp in tmpFile name', () => {
      const filePath = path.join(tempDir.path, 'output.json');
      const data = { test: true };

      // Monkey-patch fs.writeFileSync to capture tmpFile path
      const originalWriteFileSync = fs.writeFileSync;
      let capturedTmpPath = null;

      fs.writeFileSync = function(path, ...args) {
        if (typeof path === 'string' && path.endsWith('.tmp')) {
          capturedTmpPath = path;
        }
        return originalWriteFileSync.call(this, path, ...args);
      };

      try {
        writeJsonAtomically(filePath, data);
      } finally {
        fs.writeFileSync = originalWriteFileSync;
      }

      expect(capturedTmpPath).not.toBeNull();
      // Should match pattern: filePath.PID.TIMESTAMP.tmp
      const expectedPattern = new RegExp(`^${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+\\.\\d+\\.tmp$`);
      expect(capturedTmpPath).toMatch(expectedPattern);
    });

    test('should not leave .tmp files after successful write', () => {
      const filePath = path.join(tempDir.path, 'output.json');
      const data = { clean: true };

      writeJsonAtomically(filePath, data);

      // Check no .tmp files remain in the directory
      const files = fs.readdirSync(tempDir.path);
      const tmpFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tmpFiles).toEqual([]);
    });

    test('should clean up tmpFile on rename failure', () => {
      // Create a directory at the target path to force rename to fail
      const filePath = path.join(tempDir.path, 'subdir');
      fs.mkdirSync(filePath);

      let threw = false;
      try {
        writeJsonAtomically(filePath, { fail: true });
      } catch {
        threw = true;
      }

      expect(threw).toBe(true);

      // Verify no .tmp files remain
      const files = fs.readdirSync(tempDir.path);
      const tmpFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tmpFiles).toEqual([]);
    });

    test('should create parent directory when ensureDir is true', () => {
      const filePath = path.join(tempDir.path, 'nested', 'dir', 'output.json');
      const data = { nested: true };

      writeJsonAtomically(filePath, data, { ensureDir: true });

      const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(written).toEqual(data);
    });

    test('should update timestamp when autoTimestamp is true', () => {
      const filePath = path.join(tempDir.path, 'output.json');
      const data = { name: 'test' };

      writeJsonAtomically(filePath, data, { autoTimestamp: true });

      const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(written.name).toBe('test');
      expect(typeof written.updated_at).toBe('string');
      // Verify it's a valid ISO date
      expect(new Date(written.updated_at).toISOString()).toBe(written.updated_at);
    });
  });
});
