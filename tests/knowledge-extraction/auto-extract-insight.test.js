#!/usr/bin/env bun
/**
 * Tests for auto-extract-insight.js hook
 *
 * Tests cover:
 * - Pattern matching (★ Insight markers)
 * - Hash-based deduplication logic
 * - State tracking (lastProcessedUuid)
 * - Insight counting
 * - Context extraction (3 lines before insight)
 */

const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// Test Constants
// ============================================================================

const INSIGHT_START_PATTERN = /★\s*Insight\s*─+/;
const INSIGHT_END_PATTERN = /─{10,}/;
const CONTEXT_LINES = 3;

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Simple hash function (same as in hook)
 */
function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Extract insights from text with context (simplified version for testing)
 */
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
            contextBefore: contextBefore.join(' ').slice(0, 200),
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

/**
 * Count insights in markdown content
 */
function countInsights(content) {
  if (!content) return 0;
  const matches = content.match(/^## /gm);
  return matches ? matches.length : 0;
}

/**
 * Load existing hashes from insights content
 */
function loadExistingHashes(content) {
  if (!content) return new Set();

  try {
    const insightBlocks = content.split(/^## /gm).slice(1);
    const hashes = new Set();
    for (const block of insightBlocks) {
      // Match content between ### Content and either next section (###), separator (---), or end
      const contentMatch = block.match(/### Content\n\n([\s\S]*?)(?=\n### |\n---|$)/);
      if (contentMatch) {
        hashes.add(hashContent(contentMatch[1].trim()));
      }
    }
    return hashes;
  } catch {
    return new Set();
  }
}

/**
 * Create a temporary test directory
 */
function createTestDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ke-test-'));
  return {
    path: tmpDir,
    cleanup: () => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  };
}

// ============================================================================
// Pattern Matching Tests
// ============================================================================

describe('Pattern Matching', () => {
  describe('INSIGHT_START_PATTERN', () => {
    test('should match standard insight marker', () => {
      const line = '★ Insight ─────────────────────────────────────';
      expect(INSIGHT_START_PATTERN.test(line)).toBe(true);
    });

    test('should match insight marker with extra spaces', () => {
      const line = '★   Insight   ─────────────────────────────────────';
      expect(INSIGHT_START_PATTERN.test(line)).toBe(true);
    });

    test('should match insight marker with longer dash line', () => {
      const line = '★ Insight ───────────────────────────────────────────────────────';
      expect(INSIGHT_START_PATTERN.test(line)).toBe(true);
    });

    test('should NOT match without star', () => {
      const line = 'Insight ─────────────────────────────────────';
      expect(INSIGHT_START_PATTERN.test(line)).toBe(false);
    });

    test('should NOT match without dashes', () => {
      const line = '★ Insight';
      expect(INSIGHT_START_PATTERN.test(line)).toBe(false);
    });

    test('should NOT match malformed marker', () => {
      const line = '★ insight ─────────────────────────────────────'; // lowercase
      expect(INSIGHT_START_PATTERN.test(line)).toBe(false);
    });
  });

  describe('INSIGHT_END_PATTERN', () => {
    test('should match 10+ dashes', () => {
      const line = '──────────';
      expect(INSIGHT_END_PATTERN.test(line)).toBe(true);
    });

    test('should match 50 dashes', () => {
      const line = '──────────────────────────────────────────────────';
      expect(INSIGHT_END_PATTERN.test(line)).toBe(true);
    });

    test('should NOT match less than 10 dashes', () => {
      const line = '─────────';
      expect(INSIGHT_END_PATTERN.test(line)).toBe(false);
    });

    test('should NOT match mixed characters', () => {
      const line = '─────-────';
      expect(INSIGHT_END_PATTERN.test(line)).toBe(false);
    });
  });
});

// ============================================================================
// Hash Function Tests
// ============================================================================

describe('Hash Function (hashContent)', () => {
  test('should produce consistent hash for same content', () => {
    const content = 'This is a test insight';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    expect(hash1).toBe(hash2);
  });

  test('should produce different hashes for different content', () => {
    const content1 = 'This is insight A';
    const content2 = 'This is insight B';
    const hash1 = hashContent(content1);
    const hash2 = hashContent(content2);
    expect(hash1).not.toBe(hash2);
  });

  test('should handle empty string', () => {
    const hash = hashContent('');
    expect(typeof hash).toBe('string');
    expect(hash).toBe('0');
  });

  test('should handle special characters', () => {
    const content = 'Special chars: ★ ─── ✓ ✗';
    const hash = hashContent(content);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  test('should handle multiline content', () => {
    const content = 'Line 1\nLine 2\nLine 3';
    const hash = hashContent(content);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Insight Extraction Tests
// ============================================================================

describe('Insight Extraction (extractInsightsWithContext)', () => {
  test('should extract single insight', () => {
    const text = `
Some text before
★ Insight ─────────────────────────────────────
This is an important insight
─────────────────────────────────────────────────
Some text after
`;
    const insights = extractInsightsWithContext(text, null);
    expect(insights.length).toBe(1);
    expect(insights[0].content).toBe('This is an important insight');
  });

  test('should extract multiple insights', () => {
    const text = `
★ Insight ─────────────────────────────────────
First insight
─────────────────────────────────────────────────

★ Insight ─────────────────────────────────────
Second insight
─────────────────────────────────────────────────
`;
    const insights = extractInsightsWithContext(text, null);
    expect(insights.length).toBe(2);
    expect(insights[0].content).toBe('First insight');
    expect(insights[1].content).toBe('Second insight');
  });

  test('should capture context before insight', () => {
    const text = `
Context line 1
Context line 2
Context line 3
★ Insight ─────────────────────────────────────
Insight content
─────────────────────────────────────────────────
`;
    const insights = extractInsightsWithContext(text, null);
    expect(insights.length).toBe(1);
    expect(insights[0].contextBefore).toContain('Context line 1');
    expect(insights[0].contextBefore).toContain('Context line 2');
    expect(insights[0].contextBefore).toContain('Context line 3');
  });

  test('should limit context to 3 lines before', () => {
    const text = `
Line 1
Line 2
Line 3
Line 4
Line 5
★ Insight ─────────────────────────────────────
Insight content
─────────────────────────────────────────────────
`;
    const insights = extractInsightsWithContext(text, null);
    expect(insights.length).toBe(1);
    // Should only capture lines 3, 4, 5 (3 lines before)
    expect(insights[0].contextBefore).not.toContain('Line 1');
    expect(insights[0].contextBefore).not.toContain('Line 2');
    expect(insights[0].contextBefore).toContain('Line 3');
  });

  test('should include user prompt when provided', () => {
    const text = `
★ Insight ─────────────────────────────────────
Insight content
─────────────────────────────────────────────────
`;
    const userPrompt = 'How do I test this?';
    const insights = extractInsightsWithContext(text, userPrompt);
    expect(insights.length).toBe(1);
    expect(insights[0].userPrompt).toBe(userPrompt);
  });

  test('should handle unclosed insight block', () => {
    const text = `
★ Insight ─────────────────────────────────────
This insight has no closing marker
`;
    const insights = extractInsightsWithContext(text, null);
    expect(insights.length).toBe(1);
    expect(insights[0].content).toBe('This insight has no closing marker');
  });

  test('should handle empty insight block', () => {
    const text = `
★ Insight ─────────────────────────────────────
─────────────────────────────────────────────────
`;
    const insights = extractInsightsWithContext(text, null);
    expect(insights.length).toBe(0);
  });

  test('should handle multiline insight content', () => {
    const text = `
★ Insight ─────────────────────────────────────
Line 1 of insight
Line 2 of insight
Line 3 of insight
─────────────────────────────────────────────────
`;
    const insights = extractInsightsWithContext(text, null);
    expect(insights.length).toBe(1);
    expect(insights[0].content).toContain('Line 1');
    expect(insights[0].content).toContain('Line 2');
    expect(insights[0].content).toContain('Line 3');
  });

  test('should return empty array for null text', () => {
    const insights = extractInsightsWithContext(null, null);
    expect(insights).toEqual([]);
  });

  test('should return empty array for empty text', () => {
    const insights = extractInsightsWithContext('', null);
    expect(insights).toEqual([]);
  });

  test('should return empty array when no insights present', () => {
    const text = 'Just some regular text without insights';
    const insights = extractInsightsWithContext(text, null);
    expect(insights).toEqual([]);
  });
});

// ============================================================================
// Deduplication Tests
// ============================================================================

describe('Deduplication (loadExistingHashes)', () => {
  test('should load hashes from insights content', () => {
    const content = `
## 2026-01-17T10:00:00.000Z

### Content

First insight content

---

## 2026-01-17T10:05:00.000Z

### Content

Second insight content

---
`;
    const hashes = loadExistingHashes(content);
    expect(hashes.size).toBe(2);
  });

  test('should return empty set for empty content', () => {
    const hashes = loadExistingHashes('');
    expect(hashes.size).toBe(0);
  });

  test('should return empty set for null content', () => {
    const hashes = loadExistingHashes(null);
    expect(hashes.size).toBe(0);
  });

  test('should handle content with context sections', () => {
    const content = `
## 2026-01-17T10:00:00.000Z

### User Question

> How do I test this?

### Context

Some context before

### Content

Insight with context

---
`;
    const hashes = loadExistingHashes(content);
    expect(hashes.size).toBe(1);
    expect(hashes.has(hashContent('Insight with context'))).toBe(true);
  });

  test('should detect duplicate content by hash', () => {
    const insightContent = 'This is a test insight';
    const content1 = `
## 2026-01-17T10:00:00.000Z

### Content

${insightContent}

---
`;
    const hashes = loadExistingHashes(content1);
    const duplicateHash = hashContent(insightContent);
    expect(hashes.has(duplicateHash)).toBe(true);
  });
});

// ============================================================================
// State Tracking Tests
// ============================================================================

describe('State Tracking', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    testDir.cleanup();
  });

  test('should initialize with null values when state file missing', () => {
    const stateFile = path.join(testDir.path, 'state.json');
    expect(fs.existsSync(stateFile)).toBe(false);

    // Default state when file doesn't exist
    const defaultState = { lastProcessedUuid: null, lastInsightsHash: null };
    expect(defaultState.lastProcessedUuid).toBeNull();
    expect(defaultState.lastInsightsHash).toBeNull();
  });

  test('should save and load state correctly', () => {
    const stateFile = path.join(testDir.path, 'state.json');
    const state = {
      lastProcessedUuid: 'uuid-123',
      lastInsightsHash: 'hash-abc'
    };

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

    expect(loaded.lastProcessedUuid).toBe('uuid-123');
    expect(loaded.lastInsightsHash).toBe('hash-abc');
  });

  test('should handle corrupt state file gracefully', () => {
    const stateFile = path.join(testDir.path, 'state.json');
    fs.writeFileSync(stateFile, 'invalid json {');

    // Should return default state on parse error
    let state;
    try {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    } catch {
      state = { lastProcessedUuid: null, lastInsightsHash: null };
    }

    expect(state.lastProcessedUuid).toBeNull();
    expect(state.lastInsightsHash).toBeNull();
  });

  test('should update lastProcessedUuid on each extraction', () => {
    const stateFile = path.join(testDir.path, 'state.json');

    // Initial state
    const state1 = { lastProcessedUuid: 'uuid-1', lastInsightsHash: null };
    fs.writeFileSync(stateFile, JSON.stringify(state1, null, 2));

    // Update state
    const state2 = { lastProcessedUuid: 'uuid-2', lastInsightsHash: 'hash-123' };
    fs.writeFileSync(stateFile, JSON.stringify(state2, null, 2));

    const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    expect(loaded.lastProcessedUuid).toBe('uuid-2');
    expect(loaded.lastInsightsHash).toBe('hash-123');
  });
});

// ============================================================================
// Insight Counting Tests
// ============================================================================

describe('Insight Counting', () => {
  test('should count insights correctly in markdown', () => {
    const content = `
## 2026-01-17T10:00:00.000Z
Insight 1
## 2026-01-17T10:05:00.000Z
Insight 2
## 2026-01-17T10:10:00.000Z
Insight 3
`;
    const count = countInsights(content);
    expect(count).toBe(3);
  });

  test('should return 0 for empty content', () => {
    const count = countInsights('');
    expect(count).toBe(0);
  });

  test('should return 0 for null content', () => {
    const count = countInsights(null);
    expect(count).toBe(0);
  });

  test('should count all ## headers including section headers', () => {
    const content = `
# Title
## Section
### Subsection
## 2026-01-17T10:00:00.000Z
Insight
`;
    const count = countInsights(content);
    // Counts all lines starting with "## "
    expect(count).toBe(2); // "## Section" and "## 2026-01-17..."
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: End-to-End Extraction', () => {
  let testDir;

  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    testDir.cleanup();
  });

  test('should extract insights and prevent duplicates', () => {
    const text = `
★ Insight ─────────────────────────────────────
First insight
─────────────────────────────────────────────────

★ Insight ─────────────────────────────────────
Second insight
─────────────────────────────────────────────────

★ Insight ─────────────────────────────────────
First insight
─────────────────────────────────────────────────
`;

    const insights = extractInsightsWithContext(text, null);
    expect(insights.length).toBe(3);

    // Simulate deduplication
    const existingHashes = new Set();
    const uniqueInsights = [];

    for (const insight of insights) {
      const hash = hashContent(insight.content);
      if (!existingHashes.has(hash)) {
        existingHashes.add(hash);
        uniqueInsights.push(insight);
      }
    }

    expect(uniqueInsights.length).toBe(2); // First and Second, duplicate removed
  });

  test('should save insights with proper formatting', () => {
    const insightsFile = path.join(testDir.path, 'insights.md');
    const insight = {
      content: 'Test insight content',
      contextBefore: 'Context before insight',
      userPrompt: 'User question?'
    };

    const timestamp = new Date().toISOString();
    let entry = `## ${timestamp}\n\n`;

    if (insight.userPrompt) {
      entry += `### User Question\n\n> ${insight.userPrompt.replace(/\n/g, '\n> ')}\n\n`;
    }

    if (insight.contextBefore) {
      entry += `### Context\n\n${insight.contextBefore}\n\n`;
    }

    entry += `### Content\n\n${insight.content}\n\n---\n\n`;

    fs.writeFileSync(insightsFile, entry);

    const saved = fs.readFileSync(insightsFile, 'utf-8');
    expect(saved).toContain('## ');
    expect(saved).toContain('### User Question');
    expect(saved).toContain('### Context');
    expect(saved).toContain('### Content');
    expect(saved).toContain('Test insight content');
  });

  test('should detect file changes via hash comparison', () => {
    const insightsFile = path.join(testDir.path, 'insights.md');

    // Initial content
    const content1 = 'Initial insights';
    fs.writeFileSync(insightsFile, content1);
    const hash1 = hashContent(content1);

    // Modified content
    const content2 = 'Initial insights\nNew insight added';
    fs.writeFileSync(insightsFile, content2);
    const hash2 = hashContent(content2);

    expect(hash1).not.toBe(hash2);
  });

  test('should not notify if hash unchanged', () => {
    const content = 'Same content';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);

    const insightsChanged = hash1 !== hash2;
    expect(insightsChanged).toBe(false);
  });
});
