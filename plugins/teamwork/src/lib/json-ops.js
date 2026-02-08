#!/usr/bin/env bun
/**
 * Atomic JSON Operations
 * Safe read/write utilities for JSON state files
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// JSON Read Operations
// ============================================================================

/**
 * Read JSON file safely, returning null if file doesn't exist or is invalid
 * @param {string} filePath - Path to JSON file
 * @returns {any|null} Parsed JSON data or null
 */
function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ============================================================================
// JSON Write Operations
// ============================================================================

/**
 * Write JSON data atomically using temp file + rename pattern
 * @param {string} filePath - Target file path
 * @param {any} data - Data to serialize as JSON
 * @param {Object} [options]
 * @param {boolean} [options.autoTimestamp=false] - Auto-update updated_at field
 * @param {boolean} [options.ensureDir=false] - Create parent directory if needed
 */
function writeJsonAtomically(filePath, data, options = {}) {
  const { autoTimestamp = false, ensureDir = false } = options;

  // Ensure parent directory exists if requested
  if (ensureDir) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Auto-update timestamp if requested
  if (autoTimestamp && typeof data === 'object' && data !== null) {
    data.updated_at = new Date().toISOString();
  }

  // Write atomically using temp file + rename
  const tmpFile = `${filePath}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, filePath);
}

// ============================================================================
// Exports
// ============================================================================

module.exports = { readJsonSafe, writeJsonAtomically };
