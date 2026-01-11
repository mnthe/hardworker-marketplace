#!/usr/bin/env node
/**
 * Ultrawork PostToolUse Evidence Hook
 * Automatically captures evidence from tool executions
 * JavaScript/Node.js version with JSDoc types
 */

const fs = require('fs');
const {
  getSessionFile,
  updateSession,
  readSession,
} = require('../lib/session-utils.js');

/**
 * @typedef {import('../lib/types.js').EvidenceEntry} EvidenceEntry
 * @typedef {import('../lib/types.js').CommandEvidence} CommandEvidence
 * @typedef {import('../lib/types.js').FileEvidence} FileEvidence
 * @typedef {import('../lib/types.js').TestEvidence} TestEvidence
 * @typedef {import('../lib/types.js').Phase} Phase
 */

// ============================================================================
// Hook Input Interface
// ============================================================================

/**
 * @typedef {Object} ToolInput
 * @property {string} [command]
 * @property {string} [file_path]
 */

/**
 * @typedef {Object} ToolResponse
 * @property {number} [exit_code]
 */

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {string} [tool_name]
 * @property {ToolInput} [tool_input]
 * @property {ToolResponse | string} [tool_response]
 */

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Truncate large outputs to first 1K + last 1K if > 2K chars
 * @param {string} text
 * @param {number} [maxLen=2000]
 * @returns {string}
 */
function truncateOutput(text, maxLen = 2000) {
  if (text.length <= maxLen) {
    return text;
  }

  const firstChunk = text.slice(0, 1000);
  const lastChunk = text.slice(-1000);
  const truncated = text.length - 2000;

  return `${firstChunk}\n... [truncated ${truncated} bytes] ...\n${lastChunk}`;
}

/**
 * Detect if command is a test command
 * @param {string} cmd
 * @returns {boolean}
 */
function isTestCommand(cmd) {
  const testPatterns = [
    /(npm|yarn|pnpm)\s+(run\s+)?test/,
    /pytest/,
    /cargo\s+test/,
    /go\s+test/,
    /jest/,
    /vitest/,
    /phpunit/,
    /ruby\s+.*test/,
    /python.*test/,
  ];

  return testPatterns.some(pattern => pattern.test(cmd));
}

/**
 * Parse test output and extract summary
 * @param {string} output
 * @returns {string}
 */
function parseTestOutput(output) {
  // npm/jest/vitest pattern
  const npmMatch = output.match(/Tests:.*passed/);
  if (npmMatch) {
    return npmMatch[0].trim();
  }

  // pytest pattern
  const pytestMatch = output.match(/passed.*failed/);
  if (pytestMatch) {
    return pytestMatch[0].trim();
  }

  // cargo test pattern
  const cargoMatch = output.match(/test result:.*/);
  if (cargoMatch) {
    return cargoMatch[0].trim();
  }

  // go test pattern
  const goMatch = output.match(/^(PASS|FAIL).*/m);
  if (goMatch) {
    return goMatch[0].trim();
  }

  // No pattern matched - return truncated output
  return truncateOutput(output, 500);
}

/**
 * Convert tool response to string
 * @param {ToolResponse | string | undefined} response
 * @returns {string}
 */
function toolResponseToString(response) {
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && response !== null) {
    return response.stdout || '';
  }
  return '';
}

// ============================================================================
// Evidence Builders
// ============================================================================

/**
 * Build bash tool evidence (command_execution or test_result)
 * @param {string} command
 * @param {string} output
 * @param {number} exitCode
 * @returns {EvidenceEntry}
 */
function buildBashEvidence(command, output, exitCode) {
  const timestamp = new Date().toISOString();

  if (isTestCommand(command)) {
    // Test result evidence
    const summary = parseTestOutput(output);
    const passed = exitCode === 0;

    // Detect framework
    let framework = 'unknown';
    if (/npm|jest/.test(command)) framework = 'jest';
    else if (/pytest/.test(command)) framework = 'pytest';
    else if (/cargo/.test(command)) framework = 'cargo';
    else if (/go test/.test(command)) framework = 'go';
    else if (/vitest/.test(command)) framework = 'vitest';

    /** @type {TestEvidence} */
    const evidence = {
      type: 'test_result',
      timestamp,
      passed,
      framework,
      output_preview: summary,
    };

    return evidence;
  } else {
    // Command execution evidence
    const preview = truncateOutput(output, 500);

    /** @type {CommandEvidence} */
    const evidence = {
      type: 'command_execution',
      timestamp,
      command,
      exit_code: exitCode,
      output_preview: preview,
    };

    return evidence;
  }
}

/**
 * Build file operation evidence (read/write/edit)
 * @param {'read' | 'write' | 'edit'} operation
 * @param {string} filePath
 * @returns {FileEvidence}
 */
function buildFileEvidence(operation, filePath) {
  const timestamp = new Date().toISOString();

  /** @type {FileEvidence} */
  const evidence = {
    type: 'file_operation',
    timestamp,
    operation,
    path: filePath,
  };

  return evidence;
}

// ============================================================================
// Main Hook Logic
// ============================================================================

async function main() {
  try {
    // Read stdin
    const stdinBuffer = [];
    for await (const chunk of process.stdin) {
      stdinBuffer.push(chunk);
    }
    const stdinContent = Buffer.concat(stdinBuffer).toString('utf-8');

    // Parse hook input
    /** @type {HookInput} */
    let hookInput;
    try {
      hookInput = JSON.parse(stdinContent);
    } catch {
      // Invalid JSON - exit silently
      console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
      process.exit(0);
    }

    // Extract session_id
    const sessionId = hookInput.session_id;
    if (!sessionId) {
      // No session - exit silently
      console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
      process.exit(0);
    }

    // Set environment variable for session-utils
    process.env.ULTRAWORK_STDIN_SESSION_ID = sessionId;

    // Check if session exists
    const sessionFile = getSessionFile(sessionId);
    if (!fs.existsSync(sessionFile)) {
      // Session doesn't exist - exit silently
      console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
      process.exit(0);
    }

    // Read session to check phase
    const session = readSession(sessionId);
    const phase = session.phase || 'unknown';

    // Only capture evidence during EXECUTION and VERIFICATION phases
    /** @type {Phase[]} */
    const activePhases = ['EXECUTION', 'VERIFICATION'];
    if (!activePhases.includes(phase)) {
      console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
      process.exit(0);
    }

    // Extract tool_name
    const toolName = hookInput.tool_name;
    if (!toolName) {
      // No tool name - exit silently
      console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
      process.exit(0);
    }

    // Process based on tool type
    /** @type {EvidenceEntry | null} */
    let evidence = null;

    const toolNameLower = toolName.toLowerCase();

    switch (toolNameLower) {
      case 'bash': {
        // Extract command and output
        const command = hookInput.tool_input?.command;
        if (!command) break;

        const response = toolResponseToString(hookInput.tool_response);
        const exitCode = hookInput.tool_response &&
          typeof hookInput.tool_response === 'object'
          ? hookInput.tool_response.exit_code ?? 0
          : 0;

        evidence = buildBashEvidence(command, response, exitCode);
        break;
      }

      case 'write': {
        // Extract file path
        const filePath = hookInput.tool_input?.file_path;
        if (!filePath) break;

        evidence = buildFileEvidence('write', filePath);
        break;
      }

      case 'edit': {
        // Extract file path
        const filePath = hookInput.tool_input?.file_path;
        if (!filePath) break;

        evidence = buildFileEvidence('edit', filePath);
        break;
      }

      default:
        // Unknown tool - exit silently
        break;
    }

    // If we have evidence, append it to session
    if (evidence) {
      await updateSession(sessionId, (session) => {
        // Ensure evidence_log exists
        if (!session.evidence_log) {
          session.evidence_log = [];
        }

        // Append evidence
        session.evidence_log.push(evidence);

        return session;
      });
    }

    // Output required hook response
    console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
    process.exit(0);
  } catch (error) {
    // Log error but still exit 0 (hooks should never fail the tool)
    console.error('Evidence hook error:', error);
    console.log('{"hookSpecificOutput": {"hookEventName": "PostToolUse"}}');
    process.exit(0);
  }
}

// Run main
main();
