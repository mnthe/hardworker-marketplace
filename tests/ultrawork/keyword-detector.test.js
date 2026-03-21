#!/usr/bin/env bun
/**
 * Tests for keyword-detector.js hook
 * Verifies advisory mode keyword detection for implementation keywords
 */

const { describe, test, expect } = require('bun:test');
const { spawn } = require('child_process');
const path = require('path');

const HOOK_PATH = path.resolve(__dirname, '../../plugins/ultrawork/src/hooks/keyword-detector.js');

/**
 * Run the keyword-detector hook with piped stdin
 * @param {Object} input - Hook input object to pipe via stdin
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, json: Object|null}>}
 */
function runHook(input) {
  return new Promise((resolve) => {
    const proc = spawn('bun', [HOOK_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (exitCode) => {
      let json = null;
      try { json = JSON.parse(stdout.trim()); } catch {}
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: exitCode || 0, json });
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}

describe('keyword-detector advisory mode', () => {
  test('detects Korean implementation keyword "구현"', async () => {
    const result = await runHook({ user_prompt: '구현해줘 인증 시스템' });
    expect(result.exitCode).toBe(0);
    expect(result.json).not.toBeNull();
    // Advisory mode should NOT have transformedPrompt
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    // Should have additionalContext with suggestion
    expect(result.json.hookSpecificOutput.additionalContext).toBeDefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects Korean implementation keyword "만들어"', async () => {
    const result = await runHook({ user_prompt: '만들어줘 로그인 페이지' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects Korean implementation keyword "리팩토링"', async () => {
    const result = await runHook({ user_prompt: '리팩토링해줘 인증 모듈' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects Korean implementation keyword "추가해"', async () => {
    const result = await runHook({ user_prompt: '추가해줘 에러 핸들링' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects Korean implementation keyword "수정해"', async () => {
    const result = await runHook({ user_prompt: '수정해줘 버그' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects Korean implementation keyword "변경해"', async () => {
    const result = await runHook({ user_prompt: '변경해줘 설정' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects English implementation keyword "implement"', async () => {
    const result = await runHook({ user_prompt: 'implement auth system' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects English implementation keyword "build"', async () => {
    const result = await runHook({ user_prompt: 'build a login page' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects English implementation keyword "refactor"', async () => {
    const result = await runHook({ user_prompt: 'refactor the auth module' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects English implementation keyword "create"', async () => {
    const result = await runHook({ user_prompt: 'create a new component' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects English implementation keyword "add"', async () => {
    const result = await runHook({ user_prompt: 'add error handling' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('detects English implementation keyword "modify"', async () => {
    const result = await runHook({ user_prompt: 'modify the config file' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });

  test('advisory keywords are case insensitive', async () => {
    const result = await runHook({ user_prompt: 'Implement auth system' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toContain('/ultrawork-plan');
  });
});

describe('keyword-detector existing behavior preserved', () => {
  test('ultrawork keyword still transforms prompt', async () => {
    const result = await runHook({ user_prompt: 'ultrawork add auth' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeDefined();
    expect(result.json.hookSpecificOutput.transformedPrompt).toContain('/ultrawork');
  });

  test('ulw keyword still transforms prompt', async () => {
    const result = await runHook({ user_prompt: 'ulw add auth' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeDefined();
    expect(result.json.hookSpecificOutput.transformedPrompt).toContain('/ultrawork');
  });

  test('non-matching prompt passes through', async () => {
    const result = await runHook({ user_prompt: 'what is the weather today' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toBeUndefined();
  });

  test('prompt starting with / passes through', async () => {
    const result = await runHook({ user_prompt: '/ultrawork test' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeUndefined();
  });

  test('ultrawork keywords take priority over advisory keywords', async () => {
    // "ultrawork implement X" should match standard ultrawork, not advisory
    const result = await runHook({ user_prompt: 'ultrawork implement auth' });
    expect(result.exitCode).toBe(0);
    expect(result.json.hookSpecificOutput.transformedPrompt).toBeDefined();
    expect(result.json.hookSpecificOutput.transformedPrompt).toContain('/ultrawork');
  });
});

describe('keyword-detector empty/edge cases', () => {
  test('empty stdin returns passthrough', async () => {
    const result = await runHook({});
    expect(result.exitCode).toBe(0);
    expect(result.json).not.toBeNull();
  });

  test('advisory keyword alone without content passes through', async () => {
    // "implement" alone should not match (needs content after keyword)
    const result = await runHook({ user_prompt: 'implement' });
    expect(result.exitCode).toBe(0);
    // Should pass through without advisory context
    expect(result.json.hookSpecificOutput.additionalContext).toBeUndefined();
  });
});
