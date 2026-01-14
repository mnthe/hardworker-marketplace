#!/usr/bin/env bun

/**
 * Auto Extract Insight Hook
 *
 * - SubagentStop: Extract insights from transcript only
 * - Stop: Extract insights + recommend extraction if NEW insights added and threshold reached
 *
 * Storage structure: ~/.claude/knowledge-extraction/{session-id}/{state.json, insights.md}
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// Configuration
// ============================================================================

const BASE_DIR = path.join(os.homedir(), '.claude/knowledge-extraction');
const DEFAULT_THRESHOLD = 5;
const CONTEXT_LINES = 3; // Lines before insight for context

// Insight pattern: ★ Insight ─────
const INSIGHT_START_PATTERN = /★\s*Insight\s*─+/;
const INSIGHT_END_PATTERN = /─{10,}/;

// ============================================================================
// Utilities
// ============================================================================

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return chunks.join('');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getSessionDir(sessionId) {
  return path.join(BASE_DIR, sessionId);
}

function getInsightsFile(sessionId) {
  return path.join(getSessionDir(sessionId), 'insights.md');
}

function getStateFile(sessionId) {
  return path.join(getSessionDir(sessionId), 'state.json');
}

function loadState(sessionId) {
  const stateFile = getStateFile(sessionId);
  if (!fs.existsSync(stateFile)) {
    return { lastProcessedUuid: null, lastInsightsHash: null };
  }
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  } catch {
    return { lastProcessedUuid: null, lastInsightsHash: null };
  }
}

function saveState(sessionId, state) {
  const sessionDir = getSessionDir(sessionId);
  ensureDir(sessionDir);
  fs.writeFileSync(getStateFile(sessionId), JSON.stringify(state, null, 2));
}

function countInsights(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(/^## /gm);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return hashContent(content);
  } catch {
    return null;
  }
}

function getThreshold() {
  const configPath = path.join(BASE_DIR, 'config.local.md');
  if (!fs.existsSync(configPath)) {
    return DEFAULT_THRESHOLD;
  }
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const thresholdMatch = match[1].match(/threshold:\s*(\d+)/);
      if (thresholdMatch) {
        return parseInt(thresholdMatch[1], 10);
      }
    }
    return DEFAULT_THRESHOLD;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

function isAutoRecommendEnabled() {
  const configPath = path.join(BASE_DIR, 'config.local.md');
  if (!fs.existsSync(configPath)) {
    return true;
  }
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const autoMatch = match[1].match(/auto_recommend:\s*(true|false)/);
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
// Transcript Parsing
// ============================================================================

function readTranscript(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function getTextFromMessage(message) {
  if (!message?.content) return '';

  const content = message.content;
  if (Array.isArray(content)) {
    return content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n');
  } else if (typeof content === 'string') {
    return content;
  }
  return '';
}

function getNewMessagesWithContext(transcript, lastProcessedUuid) {
  let startIndex = 0;

  if (lastProcessedUuid) {
    for (let i = 0; i < transcript.length; i++) {
      if (transcript[i].uuid === lastProcessedUuid) {
        startIndex = i + 1;
        break;
      }
    }
  }

  const results = [];
  let lastUuid = lastProcessedUuid;
  let lastUserPrompt = null;

  for (let i = startIndex; i < transcript.length; i++) {
    const entry = transcript[i];
    lastUuid = entry.uuid || lastUuid;

    // Track user prompts for context
    if (entry.type === 'user') {
      const userContent = entry.message?.content;
      if (Array.isArray(userContent)) {
        const textPart = userContent.find(p => p.type === 'text');
        if (textPart) {
          lastUserPrompt = textPart.text;
        }
      } else if (typeof userContent === 'string') {
        lastUserPrompt = userContent;
      }
    }

    if (entry.type === 'assistant' && entry.message?.content) {
      const text = getTextFromMessage(entry.message);
      if (text) {
        results.push({
          text,
          uuid: entry.uuid,
          userPrompt: lastUserPrompt
        });
      }
    }
  }

  return { messages: results, lastUuid };
}

function extractInsightsWithContext(text, userPrompt) {
  if (!text) return [];

  const insights = [];
  const lines = text.split('\n');

  let inInsight = false;
  let currentInsight = [];
  let contextBefore = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (INSIGHT_START_PATTERN.test(line)) {
      inInsight = true;
      // Capture lines before insight for context
      contextBefore = lines.slice(Math.max(0, i - CONTEXT_LINES), i)
        .filter(l => !INSIGHT_START_PATTERN.test(l) && !INSIGHT_END_PATTERN.test(l))
        .map(l => l.trim())
        .filter(Boolean);
      currentInsight = [];
      continue;
    }

    if (inInsight) {
      if (INSIGHT_END_PATTERN.test(line)) {
        if (currentInsight.length > 0) {
          insights.push({
            content: currentInsight.join('\n').trim(),
            contextBefore: contextBefore.join(' ').slice(0, 200), // Limit context length
            userPrompt: userPrompt ? userPrompt.slice(0, 200) : null
          });
        }
        inInsight = false;
        currentInsight = [];
        contextBefore = [];
      } else {
        currentInsight.push(line);
      }
    }
  }

  // Handle unclosed insight block
  if (inInsight && currentInsight.length > 0) {
    insights.push({
      content: currentInsight.join('\n').trim(),
      contextBefore: contextBefore.join(' ').slice(0, 200),
      userPrompt: userPrompt ? userPrompt.slice(0, 200) : null
    });
  }

  return insights;
}

// ============================================================================
// Insight Storage
// ============================================================================

function loadExistingHashes(insightsFile) {
  if (!fs.existsSync(insightsFile)) {
    return new Set();
  }
  try {
    const content = fs.readFileSync(insightsFile, 'utf-8');
    const insightBlocks = content.split(/^## /gm).slice(1);
    const hashes = new Set();
    for (const block of insightBlocks) {
      const contentMatch = block.match(/### Content\n\n([\s\S]*?)(?=\n### |$)/);
      if (contentMatch) {
        hashes.add(hashContent(contentMatch[1].trim()));
      }
    }
    return hashes;
  } catch {
    return new Set();
  }
}

function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function saveInsight(sessionId, insight) {
  const sessionDir = getSessionDir(sessionId);
  ensureDir(sessionDir);

  const insightsFile = getInsightsFile(sessionId);
  const timestamp = new Date().toISOString();

  let entry = `## ${timestamp}\n\n`;

  // Add context section
  if (insight.userPrompt) {
    entry += `### User Question\n\n> ${insight.userPrompt.replace(/\n/g, '\n> ')}\n\n`;
  }

  if (insight.contextBefore) {
    entry += `### Context\n\n${insight.contextBefore}\n\n`;
  }

  entry += `### Content\n\n${insight.content}\n\n---\n\n`;

  fs.appendFileSync(insightsFile, entry);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    const input = await readStdin();

    let hookInput = {};
    try {
      hookInput = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    const sessionId = hookInput.session_id;
    const transcriptPath = hookInput.transcript_path;
    const hookEventName = hookInput.hook_event_name;
    const stopHookActive = hookInput.stop_hook_active;

    if (!sessionId || !transcriptPath) {
      process.exit(0);
    }

    // Prevent infinite loops
    if (stopHookActive) {
      process.exit(0);
    }

    // Load state to skip already-processed messages
    const state = loadState(sessionId);
    const insightsFile = getInsightsFile(sessionId);

    // Get hash before extraction
    const hashBefore = getFileHash(insightsFile);

    // Read and parse transcript
    const transcript = readTranscript(transcriptPath);

    // Get only new messages since last processed
    const { messages: newMessages, lastUuid } = getNewMessagesWithContext(
      transcript,
      state.lastProcessedUuid
    );

    // Extract insights from all new messages with context
    const allInsights = [];
    for (const msg of newMessages) {
      const insights = extractInsightsWithContext(msg.text, msg.userPrompt);
      allInsights.push(...insights);
    }

    // Save new insights (deduplicated by content hash)
    const existingHashes = loadExistingHashes(insightsFile);
    let newCount = 0;
    for (const insight of allInsights) {
      const hash = hashContent(insight.content);
      if (!existingHashes.has(hash)) {
        saveInsight(sessionId, insight);
        existingHashes.add(hash);
        newCount++;
      }
    }

    // Get hash after extraction
    const hashAfter = getFileHash(insightsFile);
    const insightsChanged = hashBefore !== hashAfter;

    // Save state with last processed uuid and current hash
    saveState(sessionId, {
      lastProcessedUuid: lastUuid,
      lastInsightsHash: hashAfter
    });

    // For Stop hook: recommend only if insights actually changed AND threshold reached
    if (hookEventName === 'Stop' && isAutoRecommendEnabled() && insightsChanged) {
      const insightCount = countInsights(insightsFile);
      const threshold = getThreshold();

      if (insightCount >= threshold) {
        const output = {
          decision: "block",
          reason: [
            `📝 ${newCount} new insight(s) extracted! Total: ${insightCount} (threshold: ${threshold}).`,
            "Consider running '/insights extract' to convert them into reusable components.",
            "Or continue your current work if you prefer to extract later."
          ].join('\n')
        };
        console.log(JSON.stringify(output));
      }
    }

    process.exit(0);
  } catch (error) {
    // Fail silently
    process.exit(0);
  }
}

main();
