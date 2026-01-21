#!/usr/bin/env bun

/**
 * @fileoverview Blocked pattern detection module
 * Detects phrases indicating incomplete or unprofessional work
 */

/**
 * @typedef {Object} BlockedPattern
 * @property {RegExp} regex - Regular expression to match pattern (case-insensitive)
 * @property {string} severity - Severity level: "error" | "warning" | "info"
 * @property {string} message - Human-readable description of why pattern is blocked
 */

/**
 * @typedef {Object} BlockedPatternMatch
 * @property {string} pattern - The matched pattern text
 * @property {string} severity - Severity level: "error" | "warning" | "info"
 * @property {string} message - Human-readable description
 * @property {string} match - The actual matched text from input
 */

/**
 * Blocked patterns indicating incomplete or unprofessional work
 * @type {BlockedPattern[]}
 */
export const BLOCKED_PATTERNS = [
  // CRITICAL patterns (severity: error)
  {
    regex: /should work/i,
    severity: "error",
    message: "Speculation instead of verification"
  },
  {
    regex: /probably works/i,
    severity: "error",
    message: "Lack of confidence in implementation"
  },
  {
    regex: /basic implementation/i,
    severity: "error",
    message: "Incomplete or placeholder code"
  },
  {
    regex: /you can extend this/i,
    severity: "error",
    message: "Passing responsibility to others"
  },
  {
    regex: /\bTODO\b/i,
    severity: "error",
    message: "Incomplete work marker"
  },
  {
    regex: /\bFIXME\b/i,
    severity: "error",
    message: "Known issue not addressed"
  },
  {
    regex: /not implemented/i,
    severity: "error",
    message: "Explicit incompleteness"
  },
  {
    regex: /placeholder/i,
    severity: "error",
    message: "Temporary code not replaced"
  },

  // WARNING patterns (severity: warning)
  {
    regex: /\bWIP\b/i,
    severity: "warning",
    message: "Work in progress marker"
  },
  {
    regex: /\bhack\b/i,
    severity: "warning",
    message: "Quick fix that needs proper solution"
  },
  {
    regex: /temporary/i,
    severity: "warning",
    message: "Code that should be improved"
  }
];

/**
 * Scan text for blocked patterns
 * @param {string} text - Text to scan for blocked patterns
 * @returns {BlockedPatternMatch[]} Array of pattern matches with severity and message
 */
export function scanForBlockedPatterns(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const matches = [];

  for (const pattern of BLOCKED_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      matches.push({
        pattern: pattern.regex.source,
        severity: pattern.severity,
        message: pattern.message,
        match: match[0]
      });
    }
  }

  return matches;
}

/**
 * Check if any matches have error severity (block completion)
 * @param {BlockedPatternMatch[]} matches - Array of pattern matches
 * @returns {boolean} True if any match has error severity
 */
export function shouldBlockCompletion(matches) {
  return matches.some(match => match.severity === 'error');
}
