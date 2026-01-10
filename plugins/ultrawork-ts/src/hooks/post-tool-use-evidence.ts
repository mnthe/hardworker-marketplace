#!/usr/bin/env node
/**
 * Ultrawork PostToolUse Evidence Hook
 * Automatically captures evidence from tool executions
 * TypeScript/Node.js port of post-tool-use-evidence.sh
 */

import * as fs from 'fs';
import {
  getSessionFile,
  updateSession,
  readSession,
} from '../lib/session-utils';
import {
  EvidenceEntry,
  CommandEvidence,
  FileEvidence,
  TestEvidence,
  Phase,
} from '../lib/types';

// ============================================================================
// Hook Input Interface
// ============================================================================

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    command?: string;
    file_path?: string;
    [key: string]: unknown;
  };
  tool_response?: {
    exit_code?: number;
    [key: string]: unknown;
  } | string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Truncate large outputs to first 5K + last 5K if > 10K chars
 */
function truncateOutput(text: string, maxLen: number = 10000): string {
  if (text.length <= maxLen) {
    return text;
  }

  const firstChunk = text.slice(0, 5000);
  const lastChunk = text.slice(-5000);
  const truncated = text.length - 10000;

  return `${firstChunk}\n... [truncated ${truncated} bytes] ...\n${lastChunk}`;
}

/**
 * Detect if command is a test command
 */
function isTestCommand(cmd: string): boolean {
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
 */
function parseTestOutput(output: string): string {
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
  return truncateOutput(output, 1000);
}

/**
 * Convert tool response to string
 */
function toolResponseToString(response: HookInput['tool_response']): string {
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && response !== null) {
    return JSON.stringify(response);
  }
  return '';
}

// ============================================================================
// Evidence Builders
// ============================================================================

/**
 * Build bash tool evidence (command_execution or test_result)
 */
function buildBashEvidence(
  command: string,
  output: string,
  exitCode: number
): EvidenceEntry {
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

    const evidence: TestEvidence = {
      type: 'test_result',
      timestamp,
      passed,
      framework,
      output_preview: summary,
    };

    return evidence;
  } else {
    // Command execution evidence
    const preview = truncateOutput(output, 1000);

    const evidence: CommandEvidence = {
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
 */
function buildFileEvidence(
  operation: 'read' | 'write' | 'edit',
  filePath: string
): FileEvidence {
  const timestamp = new Date().toISOString();

  const evidence: FileEvidence = {
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
    const stdinBuffer: Buffer[] = [];
    for await (const chunk of process.stdin) {
      stdinBuffer.push(chunk);
    }
    const stdinContent = Buffer.concat(stdinBuffer).toString('utf-8');

    // Parse hook input
    let hookInput: HookInput;
    try {
      hookInput = JSON.parse(stdinContent) as HookInput;
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
    const phase: Phase = session.phase || 'unknown';

    // Only capture evidence during EXECUTION and VERIFICATION phases
    const activePhases: Phase[] = ['EXECUTION', 'VERIFICATION'];
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
    let evidence: EvidenceEntry | null = null;

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

      case 'read': {
        // Extract file path
        const filePath = hookInput.tool_input?.file_path;
        if (!filePath) break;

        evidence = buildFileEvidence('read', filePath);
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
