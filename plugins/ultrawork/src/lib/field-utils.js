#!/usr/bin/env bun

/**
 * Field extraction utilities for nested objects
 * Unified implementation used by session-get, task-get, and context-get scripts
 */

/**
 * @typedef {string} FieldPath - Dot-separated field path with optional array indexing
 * @example "phase", "options.max_workers", "criteria[0].description"
 */

/**
 * Extract nested field from object using dot notation with array index support
 * @param {any} obj - Object to query
 * @param {string} fieldPath - Dot-separated field path (e.g., "foo.bar", "arr[0].name")
 * @returns {any} Field value or undefined if not found
 */
function getNestedField(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    // Handle array index notation: field[0]
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      const [, fieldName, index] = match;
      if (!(fieldName in current)) {
        return undefined;
      }
      current = current[fieldName];
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[parseInt(index, 10)];
    } else {
      if (!(part in current)) {
        return undefined;
      }
      current = current[part];
    }
  }

  return current;
}

module.exports = { getNestedField };
