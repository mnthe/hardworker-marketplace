#!/usr/bin/env bun

/**
 * SessionStart Hook - Cleanup old ultrawork sessions and provide session ID
 * v1.0: JavaScript version with JSDoc types
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createSessionStart, runHook } = require('../lib/hook-utils.js');
const { parseHookInput } = require('../lib/hook-guards.js');

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 */

/**
 * @typedef {Object} SessionData
 * @property {string} [phase]
 * @property {string} [working_dir]
 */

/**
 * @typedef {Object} StaleSession
 * @property {string} id - Short session ID (first 8 chars)
 * @property {string} phase - Current phase
 * @property {number} age_hours - Hours since last modification
 */

// ============================================================================
// Onboarding Banner Helpers
// ============================================================================

/**
 * Find stale (non-terminal, matching working_dir) sessions
 * @param {string} workingDir - Current working directory
 * @returns {StaleSession[]}
 */
function findStaleSessions(workingDir) {
  const sessionsDir = path.join(os.homedir(), '.claude', 'ultrawork', 'sessions');
  if (!fs.existsSync(sessionsDir)) return [];
  const results = [];
  try {
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      const sessionJsonPath = path.join(sessionsDir, entry.name, 'session.json');
      if (!fs.existsSync(sessionJsonPath)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
        const phase = data.phase || '';
        if (['COMPLETE', 'CANCELLED', 'FAILED'].includes(phase)) continue;
        if (data.working_dir !== workingDir) continue;
        const stats = fs.statSync(sessionJsonPath);
        const ageHours = Math.round((Date.now() - stats.mtimeMs) / (1000 * 60 * 60));
        results.push({ id: entry.name.substring(0, 8), phase, age_hours: ageHours });
      } catch { continue; }
    }
  } catch { /* ignore */ }
  return results;
}

/**
 * Find the first recommendation from the latest lesson file
 * @param {string} workingDir - Project working directory
 * @returns {string|null}
 */
function findLatestLesson(workingDir) {
  const lessonsDir = path.join(workingDir, 'docs', 'lessons');
  if (!fs.existsSync(lessonsDir)) return null;
  try {
    const files = fs.readdirSync(lessonsDir).filter(f => f.endsWith('.md')).sort().reverse();
    if (files.length === 0) return null;
    const content = fs.readFileSync(path.join(lessonsDir, files[0]), 'utf8');
    const recMatch = content.match(/## Recommendations\n([\s\S]*?)(?:\n##|$)/);
    if (!recMatch) return null;
    const firstRec = recMatch[1].trim().split('\n').find(l => l.startsWith('- '));
    return firstRec ? firstRec.replace(/^- /, '').trim() : null;
  } catch { return null; }
}

/**
 * Get count of uncommitted files in working directory
 * @param {string} workingDir - Git working directory
 * @returns {number}
 */
function getUncommittedCount(workingDir) {
  try {
    const { execSync } = require('child_process');
    const output = execSync('git status --porcelain', { cwd: workingDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output.trim() ? output.trim().split('\n').length : 0;
  } catch { return 0; }
}

/**
 * Build onboarding banner with stale sessions, lessons, and git status
 * @param {string} workingDir - Current working directory
 * @returns {string|null} Banner text or null if nothing to show
 */
function buildOnboardingBanner(workingDir) {
  const staleSessions = findStaleSessions(workingDir);
  const latestLesson = findLatestLesson(workingDir);
  const uncommitted = getUncommittedCount(workingDir);
  if (staleSessions.length === 0 && !latestLesson && uncommitted === 0) return null;
  const lines = [];
  if (staleSessions.length > 0) {
    lines.push(`Stale sessions: ${staleSessions.length}`);
    for (const s of staleSessions) {
      lines.push(`  ${s.id}: ${s.phase} (${s.age_hours}h idle)`);
    }
  }
  if (latestLesson) {
    lines.push(`Recent lesson: "${latestLesson}"`);
  }
  if (uncommitted > 0) {
    lines.push(`Git: ${uncommitted} uncommitted files`);
  }
  return lines.join('\n');
}

// ============================================================================
// Session Cleanup
// ============================================================================

/**
 * Cleanup old sessions (completed/cancelled/failed older than 7 days)
 * @returns {void}
 */
function cleanupOldSessions() {
  const sessionsDir = path.join(os.homedir(), '.claude', 'ultrawork', 'sessions');

  if (!fs.existsSync(sessionsDir)) {
    return;
  }

  try {
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
    const sessionDirs = entries.filter(e => e.isDirectory());

    // Only cleanup if there are more than 10 sessions
    if (sessionDirs.length <= 10) {
      return;
    }

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const entry of sessionDirs) {
      const sessionPath = path.join(sessionsDir, entry.name);
      const sessionJsonPath = path.join(sessionPath, 'session.json');

      if (!fs.existsSync(sessionJsonPath)) {
        continue;
      }

      // Check if directory is older than 7 days
      const stats = fs.statSync(sessionPath);
      if (stats.mtimeMs > sevenDaysAgo) {
        continue;
      }

      // Check if session is in terminal state
      try {
        /** @type {SessionData} */
        const sessionData = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf8'));
        const phase = sessionData.phase || '';

        if (phase === 'COMPLETE' || phase === 'CANCELLED' || phase === 'FAILED') {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (err) {
        // Ignore parse errors, just skip this session
        continue;
      }
    }
  } catch (err) {
    // Silently ignore cleanup errors
  }
}

/**
 * Main hook logic
 * @returns {Promise<void>}
 */
async function main() {
  /** @type {HookInput} */
  const hookInput = await parseHookInput();

  // Extract session_id
  const sessionId = hookInput?.session_id;

  // Cleanup old sessions
  cleanupOldSessions();

  // Output session ID for AI to use
  let systemMessage = sessionId
    ? `CLAUDE_SESSION_ID: ${sessionId}`
    : undefined;

  // Append onboarding banner if applicable
  const banner = buildOnboardingBanner(process.cwd());
  if (banner) {
    systemMessage = systemMessage
      ? `${systemMessage}\n\n${banner}`
      : banner;
  }

  const output = createSessionStart(systemMessage);
  console.log(JSON.stringify(output));
  process.exit(0);
}

// Entry point
runHook(main, () => ({}));

// Export for testing (only when required as module, not when run directly)
if (require.main !== module) {
  module.exports = { findStaleSessions, findLatestLesson, getUncommittedCount, buildOnboardingBanner };
}
