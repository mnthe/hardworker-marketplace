#!/usr/bin/env bun
/**
 * Tests for hook-utils.js - Hook utility functions
 */

const { describe, test, expect } = require('bun:test');
const {
  createPreToolUseAllow,
  createPreToolUseBlock,
  createPreToolUsePermission,
  createPostToolUse,
  createUserPromptSubmit,
  createSessionStart,
  createStopResponse,
  outputAndExit,
  handleHookError
} = require('../../../plugins/ultrawork/src/lib/hook-utils.js');

describe('hook-utils.js', () => {
  describe('createPreToolUseAllow', () => {
    test('should create allow response', () => {
      const result = createPreToolUseAllow();

      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          decision: 'allow'
        }
      });
    });
  });

  describe('createPreToolUseBlock', () => {
    test('should create block response with reason', () => {
      const result = createPreToolUseBlock('Test blocked');

      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          decision: 'block',
          reason: 'Test blocked'
        }
      });
    });

    test('should include additional context when provided', () => {
      const result = createPreToolUseBlock('Test blocked', 'Additional details');

      expect(result.hookSpecificOutput.additionalContext).toBe('Additional details');
    });

    test('should not include additionalContext when not provided', () => {
      const result = createPreToolUseBlock('Test blocked');

      expect(result.hookSpecificOutput.additionalContext).toBeUndefined();
    });
  });

  describe('createPreToolUsePermission', () => {
    test('should create permission allow response', () => {
      const result = createPreToolUsePermission('allow');

      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow'
        }
      });
    });

    test('should create permission block response', () => {
      const result = createPreToolUsePermission('block');

      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'block'
        }
      });
    });
  });

  describe('createPostToolUse', () => {
    test('should create PostToolUse response', () => {
      const result = createPostToolUse();

      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse'
        }
      });
    });
  });

  describe('createUserPromptSubmit', () => {
    test('should create basic UserPromptSubmit response', () => {
      const result = createUserPromptSubmit();

      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit'
        }
      });
    });

    test('should include additional context when provided', () => {
      const result = createUserPromptSubmit({
        additionalContext: 'Session context'
      });

      expect(result.hookSpecificOutput.additionalContext).toBe('Session context');
    });

    test('should include transformed prompt when provided', () => {
      const result = createUserPromptSubmit({
        transformedPrompt: 'New prompt text'
      });

      expect(result.hookSpecificOutput.transformedPrompt).toBe('New prompt text');
    });

    test('should include both options when provided', () => {
      const result = createUserPromptSubmit({
        additionalContext: 'Context',
        transformedPrompt: 'Transformed'
      });

      expect(result.hookSpecificOutput.additionalContext).toBe('Context');
      expect(result.hookSpecificOutput.transformedPrompt).toBe('Transformed');
    });
  });

  describe('createSessionStart', () => {
    test('should create empty SessionStart response', () => {
      const result = createSessionStart();

      expect(result).toEqual({});
    });

    test('should include system message when provided', () => {
      const result = createSessionStart('Test system message');

      expect(result).toEqual({
        systemMessage: 'Test system message'
      });
    });
  });

  describe('createStopResponse', () => {
    test('should create empty Stop response', () => {
      const result = createStopResponse();

      expect(result).toEqual({});
    });

    test('should include decision when provided', () => {
      const result = createStopResponse({ decision: 'allow' });

      expect(result.decision).toBe('allow');
    });

    test('should include reason when provided', () => {
      const result = createStopResponse({ reason: 'Test reason' });

      expect(result.reason).toBe('Test reason');
    });

    test('should include system message when provided', () => {
      const result = createStopResponse({ systemMessage: 'System msg' });

      expect(result.systemMessage).toBe('System msg');
    });

    test('should include all options when provided', () => {
      const result = createStopResponse({
        decision: 'block',
        reason: 'Test block',
        systemMessage: 'Test message'
      });

      expect(result.decision).toBe('block');
      expect(result.reason).toBe('Test block');
      expect(result.systemMessage).toBe('Test message');
    });
  });

  describe('outputAndExit', () => {
    test('should output JSON and exit with code 0', () => {
      const originalExit = process.exit;
      const originalLog = console.log;
      let exitCode = null;
      let output = '';

      process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
      console.log = (msg) => { output = msg; };

      try {
        outputAndExit({ status: 'success' });
      } catch (e) {
        // Expected to throw
      }

      process.exit = originalExit;
      console.log = originalLog;

      expect(exitCode).toBe(0);
      expect(output).toBe('{"status":"success"}');
    });

    test('should exit with custom exit code', () => {
      const originalExit = process.exit;
      let exitCode = null;

      process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
      console.log = () => {}; // Suppress output

      try {
        outputAndExit({ status: 'error' }, 1);
      } catch (e) {
        // Expected to throw
      }

      process.exit = originalExit;

      expect(exitCode).toBe(1);
    });
  });

  describe('handleHookError', () => {
    test('should output fallback and exit with code 0', () => {
      const originalExit = process.exit;
      const originalLog = console.log;
      let exitCode = null;
      let output = '';

      process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
      console.log = (msg) => { output = msg; };

      const fallback = () => ({ hookSpecificOutput: { hookEventName: 'Test' } });

      try {
        handleHookError(fallback);
      } catch (e) {
        // Expected to throw
      }

      process.exit = originalExit;
      console.log = originalLog;

      expect(exitCode).toBe(0);
      expect(JSON.parse(output)).toEqual({
        hookSpecificOutput: { hookEventName: 'Test' }
      });
    });
  });

  describe('exports', () => {
    test('should export all required functions', () => {
      const hookUtils = require('../../../plugins/ultrawork/src/lib/hook-utils.js');

      expect(typeof hookUtils.createPreToolUseAllow).toBe('function');
      expect(typeof hookUtils.createPreToolUseBlock).toBe('function');
      expect(typeof hookUtils.createPreToolUsePermission).toBe('function');
      expect(typeof hookUtils.createPostToolUse).toBe('function');
      expect(typeof hookUtils.createUserPromptSubmit).toBe('function');
      expect(typeof hookUtils.createSessionStart).toBe('function');
      expect(typeof hookUtils.createStopResponse).toBe('function');
      expect(typeof hookUtils.outputAndExit).toBe('function');
      expect(typeof hookUtils.handleHookError).toBe('function');
      expect(typeof hookUtils.runHook).toBe('function');
      expect(typeof hookUtils.readStdin).toBe('function');
    });
  });
});
