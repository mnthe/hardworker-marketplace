#!/usr/bin/env bun

/**
 * Ultrawork Magic Keyword Detection Hook
 * Detects ultrawork keywords and transforms prompts to /ultrawork commands
 *
 * Keywords:
 *   - ultrawork, ulw, uw → /ultrawork "{original prompt}"
 *   - ultrawork-plan, ulw-plan, uw-plan → /ultrawork --plan-only "{original prompt}"
 *   - ultrawork-auto, ulw-auto, uw-auto → /ultrawork --auto "{original prompt}"
 *
 * Advisory keywords (suggest /ultrawork-plan, do not transform prompt):
 *   - Korean: 구현, 만들어, 리팩토링, 추가해, 수정해, 변경해
 *   - English: implement, build, refactor, create, add, modify
 *
 * Skip conditions:
 *   - Prompt already starts with /
 *   - Active ultrawork session exists (non-terminal phase)
 */

const fs = require('fs');
const { getSessionFile } = require('../lib/session-utils.js');
const {
  createUserPromptSubmit,
  runHook
} = require('../lib/hook-utils.js');
const { parseHookInput } = require('../lib/hook-guards.js');

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id] - Current session ID
 * @property {string} [user_prompt] - The user's prompt text
 */

/**
 * Keyword patterns for ultrawork activation
 */
const KEYWORD_PATTERNS = {
  // Auto mode keywords (most specific first)
  autoMode: [
    /^(ultrawork-auto|ulw-auto|uw-auto)\s+(.+)$/i,
    /^(ultrawork|ulw|uw)\s+--auto\s+(.+)$/i
  ],
  // Plan-only mode keywords
  planOnly: [
    /^(ultrawork-plan|ulw-plan|uw-plan)\s+(.+)$/i,
    /^(ultrawork|ulw|uw)\s+--plan-only\s+(.+)$/i
  ],
  // Standard mode keywords
  standard: [
    /^(ultrawork|ulw|uw)\s+(.+)$/i
  ],
  // Advisory mode keywords (구현 키워드 — 제안 only, prompt 변경 없음)
  advisory: [
    /^(구현|만들어|리팩토링|추가해|수정해|변경해)\S*\s+(.+)$/i,
    /^(implement|build|refactor|create|add|modify)\s+(.+)$/i
  ]
};

/**
 * Check if session is active (non-terminal phase)
 * @param {string|undefined} sessionId
 * @returns {boolean}
 */
function isSessionActive(sessionId) {
  if (!sessionId) return false;

  try {
    const sessionFile = getSessionFile(sessionId);
    if (!fs.existsSync(sessionFile)) return false;

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    const phase = session.phase || 'unknown';

    // Terminal states
    const terminalStates = ['COMPLETE', 'CANCELLED', 'FAILED'];
    return !terminalStates.includes(phase);
  } catch {
    return false;
  }
}

/**
 * Try to match prompt against keyword patterns
 * @param {string} prompt
 * @returns {{ mode: 'auto'|'plan-only'|'standard'|'advisory', goal: string } | null}
 */
function matchKeyword(prompt) {
  // Check auto mode patterns first
  for (const pattern of KEYWORD_PATTERNS.autoMode) {
    const match = prompt.match(pattern);
    if (match) {
      return { mode: 'auto', goal: match[2].trim() };
    }
  }

  // Check plan-only patterns
  for (const pattern of KEYWORD_PATTERNS.planOnly) {
    const match = prompt.match(pattern);
    if (match) {
      return { mode: 'plan-only', goal: match[2].trim() };
    }
  }

  // Check standard patterns
  for (const pattern of KEYWORD_PATTERNS.standard) {
    const match = prompt.match(pattern);
    if (match) {
      return { mode: 'standard', goal: match[2].trim() };
    }
  }

  // Check advisory patterns last (구현 키워드 suggest only)
  for (const pattern of KEYWORD_PATTERNS.advisory) {
    const match = prompt.match(pattern);
    if (match) {
      return { mode: 'advisory', goal: match[2].trim() };
    }
  }

  return null;
}

/**
 * Transform prompt to /ultrawork command
 * @param {string} mode
 * @param {string} goal
 * @returns {string}
 */
function buildCommand(mode, goal) {
  // Escape quotes in goal
  const escapedGoal = goal.replace(/"/g, '\\"');

  switch (mode) {
    case 'auto':
      return `/ultrawork --auto "${escapedGoal}"`;
    case 'plan-only':
      return `/ultrawork --plan-only "${escapedGoal}"`;
    default:
      return `/ultrawork "${escapedGoal}"`;
  }
}

/**
 * Main hook logic
 */
async function main() {
  /** @type {HookInput} */
  const hookInput = await parseHookInput();
  if (!hookInput) {
    console.log(JSON.stringify(createUserPromptSubmit()));
    process.exit(0);
    return;
  }

  const prompt = hookInput.user_prompt || '';
  const sessionId = hookInput.session_id;

  // Skip if prompt already starts with /
  if (prompt.trim().startsWith('/')) {
    console.log(JSON.stringify(createUserPromptSubmit()));
    process.exit(0);
    return;
  }

  // Skip if session is already active
  if (isSessionActive(sessionId)) {
    console.log(JSON.stringify(createUserPromptSubmit()));
    process.exit(0);
    return;
  }

  // Try to match keyword
  const match = matchKeyword(prompt.trim());

  if (!match) {
    // No keyword match - pass through
    console.log(JSON.stringify(createUserPromptSubmit()));
    process.exit(0);
    return;
  }

  // Advisory mode: 제안 only — prompt 변경 없이 additionalContext로 /ultrawork-plan suggest
  if (match.mode === 'advisory') {
    const output = createUserPromptSubmit({
      additionalContext: '💡 구현 작업이 감지되었습니다. `/ultrawork-plan`을 사용하면 체계적인 planning이 가능합니다.'
    });
    console.log(JSON.stringify(output));
    process.exit(0);
    return;
  }

  // Build transformed command
  const transformedPrompt = buildCommand(match.mode, match.goal);

  const output = createUserPromptSubmit({
    transformedPrompt: transformedPrompt,
    additionalContext: `🔄 Magic keyword detected: "${prompt.split(' ')[0]}" → Executing: ${transformedPrompt}`
  });

  console.log(JSON.stringify(output));
  process.exit(0);
}

// Entry point
runHook(main, createUserPromptSubmit);
