#!/usr/bin/env bun
/**
 * Field Extraction Utilities
 * Unified nested field extraction with dot notation and array index support
 */

// ============================================================================
// Field Extraction
// ============================================================================

/**
 * Extract nested field from object using dot notation with array index support
 * Examples: "status", "stats.total", "tasks[0].title", "arr[2].nested"
 * @param {any} obj - Object to query
 * @param {string} fieldPath - Dot-separated field path
 * @returns {any} Field value or undefined if not found
 */
function getNestedField(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array access: field[0]
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      const [, fieldName, index] = match;
      current = current[fieldName];
      if (!current || !Array.isArray(current)) {
        return undefined;
      }
      current = current[parseInt(index, 10)];
    } else {
      current = current[part];
    }

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = { getNestedField };
