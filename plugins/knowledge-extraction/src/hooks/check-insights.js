#!/usr/bin/env node

/**
 * Stop Hook - Check if insights exist at session end
 * Reminds user to extract insights if any were collected during the session
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Types (JSDoc)
// ============================================================================

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 */

/**
 * @typedef {Object} HookOutput
 * @property {string} [additionalContext]
 */

// ============================================================================
// Configuration
// ============================================================================

const STORAGE_DIR = '.claude/knowledge-extraction/sessions';

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

    // Extract session_id
    const sessionId = hookInput.session_id;

    if (!sessionId) {
      // No session ID, exit silently
      process.exit(0);
    }

    // Check for insights
    const sessionFile = getSessionFile(sessionId);
    const insightCount = countInsights(sessionFile);

    if (insightCount > 0) {
      // Build reminder message
      /** @type {HookOutput} */
      const output = {
        additionalContext: [
          '---',
          `📝 This session has ${insightCount} insight(s) collected.`,
          "Consider running '/insights extract' to convert them into reusable components.",
          '---'
        ].join('\n')
      };

      console.log(JSON.stringify(output));
    }

    process.exit(0);
  } catch (error) {
    // Fail silently - don't block session end
    process.exit(0);
  }
}

main();
