/**
 * Hook Utilities - Common functions for ultrawork lifecycle hooks
 * Provides stdin reading, output formatting, and error handling helpers
 */

// ============================================================================
// Stdin Handling
// ============================================================================

/**
 * Read all stdin data as a string
 * @returns {Promise<string>} Stdin content
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return chunks.join('');
}

// ============================================================================
// Hook Output Helpers
// ============================================================================

/**
 * Create PreToolUse allow response
 * @returns {Object} Hook output
 */
function createPreToolUseAllow() {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      decision: 'allow'
    }
  };
}

/**
 * Create PreToolUse block response
 * @param {string} reason - Short reason for blocking
 * @param {string} [additionalContext] - Detailed context message
 * @returns {Object} Hook output
 */
function createPreToolUseBlock(reason, additionalContext) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      decision: 'block',
      reason
    }
  };

  if (additionalContext) {
    output.hookSpecificOutput.additionalContext = additionalContext;
  }

  return output;
}

/**
 * Create PreToolUse response with permission decision
 * @param {'allow' | 'block'} decision - Permission decision
 * @returns {Object} Hook output
 */
function createPreToolUsePermission(decision) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision
    }
  };
}

/**
 * Create PostToolUse response
 * @returns {Object} Hook output
 */
function createPostToolUse() {
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse'
    }
  };
}

/**
 * Create UserPromptSubmit response
 * @param {Object} [options] - Optional parameters
 * @param {string} [options.additionalContext] - Context to inject
 * @param {string} [options.transformedPrompt] - Transformed prompt
 * @returns {Object} Hook output
 */
function createUserPromptSubmit(options = {}) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit'
    }
  };

  if (options.additionalContext) {
    output.hookSpecificOutput.additionalContext = options.additionalContext;
  }

  if (options.transformedPrompt) {
    output.hookSpecificOutput.transformedPrompt = options.transformedPrompt;
  }

  return output;
}

/**
 * Create SessionStart response
 * @param {string} [systemMessage] - Optional system message
 * @returns {Object} Hook output
 */
function createSessionStart(systemMessage) {
  const output = {};

  if (systemMessage) {
    output.systemMessage = systemMessage;
  }

  return output;
}

/**
 * Create Stop hook response
 * @param {Object} [options] - Optional parameters
 * @param {'allow' | 'block'} [options.decision] - Block/allow decision
 * @param {string} [options.reason] - Reason for blocking
 * @param {string} [options.systemMessage] - System message
 * @returns {Object} Hook output
 */
function createStopResponse(options = {}) {
  const output = {};

  if (options.decision) {
    output.decision = options.decision;
  }

  if (options.reason) {
    output.reason = options.reason;
  }

  if (options.systemMessage) {
    output.systemMessage = options.systemMessage;
  }

  return output;
}

// ============================================================================
// Error Handling & Output Helpers
// ============================================================================

/**
 * Output JSON and exit with code
 * @param {Object} output - JSON object to output
 * @param {number} [exitCode=0] - Exit code (default: 0)
 * @returns {never}
 */
function outputAndExit(output, exitCode = 0) {
  console.log(JSON.stringify(output));
  process.exit(exitCode);
}

/**
 * Safe error handler for hooks - outputs fallback response and exits cleanly
 * @param {Function} fallbackOutputFn - Function that returns fallback output object
 * @returns {never}
 */
function handleHookError(fallbackOutputFn) {
  const output = fallbackOutputFn();
  console.log(JSON.stringify(output));
  process.exit(0);
}

// ============================================================================
// Hook Entry Point Runner
// ============================================================================

/**
 * Standard hook entry point that handles stdin TTY checks and error handling
 * @param {Function} mainFn - Async main function to run
 * @param {Function} fallbackOutputFn - Function that returns fallback output on error
 * @returns {void}
 */
function runHook(mainFn, fallbackOutputFn) {
  // Handle stdin availability
  if (process.stdin.isTTY) {
    // No stdin available, output fallback response
    const output = fallbackOutputFn();
    console.log(JSON.stringify(output));
    process.exit(0);
  } else {
    // Read stdin and process
    process.stdin.setEncoding('utf8');
    mainFn()
      .then(() => process.exit(0))
      .catch(() => {
        // On error, output fallback and exit 0
        const output = fallbackOutputFn();
        console.log(JSON.stringify(output));
        process.exit(0);
      });
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Stdin
  readStdin,

  // Hook output creators
  createPreToolUseAllow,
  createPreToolUseBlock,
  createPreToolUsePermission,
  createPostToolUse,
  createUserPromptSubmit,
  createSessionStart,
  createStopResponse,

  // Output & error handling
  outputAndExit,
  handleHookError,
  runHook
};
