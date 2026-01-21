#!/usr/bin/env bun

/**
 * Teamwork PostToolUse Evidence Hook
 * Automatically captures evidence from tool executions during EXECUTION and VERIFICATION phases
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { readStdin, outputAndExit, hasStdin } = require('../lib/hook-utils.js');
const { getProjectDir, projectExists, readProject } = require('../lib/project-utils.js');

// ============================================================================
// Constants
// ============================================================================

const TEAMWORK_DIR = path.join(os.homedir(), '.claude', 'teamwork');
const STATE_DIR = path.join(TEAMWORK_DIR, '.loop-state');

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
 * @property {string} [stdout]
 */

/**
 * @typedef {Object} HookInput
 * @property {string} [tool_name]
 * @property {ToolInput} [tool_input]
 * @property {ToolResponse | string} [tool_response]
 */

/**
 * @typedef {Object} LoopState
 * @property {boolean} active
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [role]
 */

/**
 * @typedef {Object} EvidenceEntry
 * @property {'command' | 'test' | 'file' | 'note'} type
 * @property {string} timestamp
 * @property {string} [command]
 * @property {number} [exit_code]
 * @property {string} [output]
 * @property {string} [action]
 * @property {string} [path]
 */

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get unique terminal identifier
 * @returns {string} Terminal ID
 */
function getTerminalId() {
  return process.env.CLAUDE_SESSION_ID || String(process.pid);
}

/**
 * Get loop state to determine project/team context
 * @returns {LoopState | null}
 */
function getLoopState() {
  const terminalId = getTerminalId();
  const stateFile = path.join(STATE_DIR, `${terminalId}.json`);

  if (!fs.existsSync(stateFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(stateFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

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
 * Build bash tool evidence (command or test)
 * @param {string} command
 * @param {string} output
 * @param {number} exitCode
 * @returns {EvidenceEntry}
 */
function buildBashEvidence(command, output, exitCode) {
  const timestamp = new Date().toISOString();
  const isTest = isTestCommand(command);
  const preview = truncateOutput(output, 500);

  /** @type {EvidenceEntry} */
  const evidence = {
    type: isTest ? 'test' : 'command',
    timestamp,
    command,
    exit_code: exitCode,
    output: preview,
  };

  return evidence;
}

/**
 * Build file operation evidence (write/edit)
 * @param {'created' | 'modified'} action
 * @param {string} filePath
 * @returns {EvidenceEntry}
 */
function buildFileEvidence(action, filePath) {
  const timestamp = new Date().toISOString();

  /** @type {EvidenceEntry} */
  const evidence = {
    type: 'file',
    timestamp,
    action,
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
    const stdinContent = await readStdin();

    // Parse hook input
    /** @type {HookInput} */
    let hookInput;
    try {
      hookInput = JSON.parse(stdinContent);
    } catch {
      // Invalid JSON - exit silently
      outputAndExit({});
      return;
    }

    // Get loop state to determine project/team context
    const loopState = getLoopState();
    if (!loopState || !loopState.project || !loopState.team) {
      // No loop state - exit silently (not in teamwork context)
      outputAndExit({});
      return;
    }

    const project = loopState.project;
    const team = loopState.team;

    // Check if project exists
    if (!projectExists(project, team)) {
      // Project doesn't exist - exit silently
      outputAndExit({});
      return;
    }

    // Read project phase
    const projectData = readProject(project, team);
    const phase = projectData.phase || 'unknown';

    // Only capture evidence during EXECUTION and VERIFICATION phases
    const activePhases = ['EXECUTION', 'VERIFICATION'];
    if (!activePhases.includes(phase)) {
      outputAndExit({});
      return;
    }

    // Extract tool_name
    const toolName = hookInput.tool_name;
    if (!toolName) {
      // No tool name - exit silently
      outputAndExit({});
      return;
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

        evidence = buildFileEvidence('created', filePath);
        break;
      }

      case 'edit': {
        // Extract file path
        const filePath = hookInput.tool_input?.file_path;
        if (!filePath) break;

        evidence = buildFileEvidence('modified', filePath);
        break;
      }

      default:
        // Unknown tool - exit silently
        break;
    }

    // If we have evidence, append to verification/evidence.jsonl (append-only)
    if (evidence) {
      const projectDir = getProjectDir(project, team);
      const verificationDir = path.join(projectDir, 'verification');
      const evidenceLog = path.join(verificationDir, 'evidence.jsonl');

      // Ensure verification directory exists
      if (!fs.existsSync(verificationDir)) {
        fs.mkdirSync(verificationDir, { recursive: true });
      }

      // Append evidence as single JSON line (no file locking needed)
      const line = JSON.stringify(evidence) + '\n';
      fs.appendFileSync(evidenceLog, line, 'utf-8');
    }

    // Output required hook response
    outputAndExit({});
  } catch (err) {
    // On error, output minimal valid JSON and exit 0
    // Hooks should never fail the tool execution
    outputAndExit({});
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Check stdin availability before processing
if (!hasStdin()) {
  // No stdin available, output minimal response
  outputAndExit({});
}

// Read stdin and process
process.stdin.setEncoding('utf8');
main().catch(() => {
  // On error, output minimal valid JSON and exit 0
  // Hooks should never fail the tool execution
  outputAndExit({});
});
