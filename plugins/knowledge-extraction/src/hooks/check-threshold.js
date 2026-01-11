#!/usr/bin/env node

/**
 * PostToolUse Hook - Check if insight threshold is reached
 * Triggers after Write tool use to check if insights file reached threshold
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Types (JSDoc)
// ============================================================================

/**
 * @typedef {Object} ToolInput
 * @property {string} [file_path]
 */

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {ToolInput} [tool_input]
 */

/**
 * @typedef {Object} HookOutput
 * @property {string} [additionalContext]
 */

// ============================================================================
// Configuration
// ============================================================================

const STORAGE_DIR = '.claude/knowledge-extraction/sessions';
const DEFAULT_THRESHOLD = 5;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Read all stdin data
 * @returns {Promise<string>}
 */
async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

/**
 * Get session file path
 * @param {string} sessionId
 * @returns {string}
 */
function getSessionFile(sessionId) {
  return path.join(process.cwd(), STORAGE_DIR, `${sessionId}.md`);
}

/**
 * Check if file path is a knowledge-extraction session file
 * @param {string} filePath
 * @returns {boolean}
 */
function isSessionFile(filePath) {
  if (!filePath) {
    return false;
  }
  // Match .claude/knowledge-extraction/sessions/*.md
  return /\.claude\/knowledge-extraction\/sessions\/.*\.md$/.test(filePath);
}

/**
 * Count insights in session file
 * @param {string} filePath
 * @returns {number}
 */
function countInsights(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Count lines starting with "## " (insight timestamps)
    const matches = content.match(/^## /gm);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Read threshold from config file
 * @returns {number}
 */
function getThreshold() {
  const configPath = path.join(process.cwd(), '.claude/knowledge-extraction/config.local.md');

  if (!fs.existsSync(configPath)) {
    return DEFAULT_THRESHOLD;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    // Parse YAML frontmatter for threshold
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const frontmatter = match[1];
      const thresholdMatch = frontmatter.match(/threshold:\s*(\d+)/);
      if (thresholdMatch) {
        return parseInt(thresholdMatch[1], 10);
      }
    }
    return DEFAULT_THRESHOLD;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

/**
 * Check if auto_recommend is enabled
 * @returns {boolean}
 */
function isAutoRecommendEnabled() {
  const configPath = path.join(process.cwd(), '.claude/knowledge-extraction/config.local.md');

  if (!fs.existsSync(configPath)) {
    return true; // Default to enabled
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const frontmatter = match[1];
      const autoMatch = frontmatter.match(/auto_recommend:\s*(true|false)/);
      if (autoMatch) {
        return autoMatch[1] === 'true';
      }
    }
    return true;
  } catch {
    return true;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    // Read stdin
    const input = await readStdin();

    // Parse JSON input
    /** @type {HookInput} */
    let hookInput = {};
    try {
      hookInput = JSON.parse(input);
    } catch {
      // No valid JSON, exit silently
      process.exit(0);
    }

    // Check if this is a Write to our session files
    const filePath = hookInput.tool_input?.file_path;
    if (!isSessionFile(filePath)) {
      // Not our file, exit silently
      process.exit(0);
    }

    // Check if auto_recommend is enabled
    if (!isAutoRecommendEnabled()) {
      process.exit(0);
    }

    // Extract session_id
    const sessionId = hookInput.session_id;

    if (!sessionId) {
      process.exit(0);
    }

    // Check insight count against threshold
    const sessionFile = getSessionFile(sessionId);
    const insightCount = countInsights(sessionFile);
    const threshold = getThreshold();

    if (insightCount >= threshold) {
      // Build reminder message
      /** @type {HookOutput} */
      const output = {
        additionalContext: [
          '---',
          `📝 You've collected ${insightCount} insights (threshold: ${threshold}).`,
          "Consider running '/insights extract' to convert them into reusable components.",
          '---'
        ].join('\n')
      };

      console.log(JSON.stringify(output));
    }

    process.exit(0);
  } catch (error) {
    // Fail silently - don't interfere with normal operation
    process.exit(0);
  }
}

main();
