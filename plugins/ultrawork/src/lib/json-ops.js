#!/usr/bin/env bun

/**
 * Atomic JSON file operations
 * Provides safe read/write with temp-file-rename pattern
 */

const fs = require('fs');
const path = require('path');

/**
 * Read JSON file safely, returning null if file doesn't exist or is invalid
 * @param {string} filePath - Path to JSON file
 * @returns {any|null} Parsed JSON data or null
 */
function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write JSON data atomically using temp file + rename pattern
 * @param {string} filePath - Target file path
 * @param {any} data - Data to serialize as JSON
 * @param {Object} [options]
 * @param {boolean} [options.autoTimestamp=false] - Auto-update updated_at field
 * @param {boolean} [options.ensureDir=false] - Create parent directory if needed
 */
function writeJsonAtomically(filePath, data, options = {}) {
  if (options.ensureDir) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  if (options.autoTimestamp && data && typeof data === 'object') {
    data.updated_at = new Date().toISOString();
  }

  const tmpFile = `${filePath}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, filePath);
}

module.exports = { readJsonSafe, writeJsonAtomically };
