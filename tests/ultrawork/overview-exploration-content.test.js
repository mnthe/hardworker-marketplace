#!/usr/bin/env bun
/**
 * Content validation tests for overview-exploration SKILL.md
 * Ensures the skill file contains quantitative data collection and goal-aligned exploration guidance.
 */

const fs = require('fs');
const path = require('path');
const { describe, test, expect } = require('bun:test');

const SKILL_PATH = path.join(
  __dirname,
  '../../plugins/ultrawork/skills/overview-exploration/SKILL.md'
);

describe('overview-exploration SKILL.md content validation', () => {
  let content;

  test('file exists and is readable', () => {
    content = fs.readFileSync(SKILL_PATH, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  describe('Quantitative Data Collection', () => {
    test('contains quantitative data collection section heading', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toMatch(/#+\s*.*Quantitative Data Collection/);
    });

    test('contains test file count command', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toContain('find . -name "*.test.*"');
    });

    test('contains interface signature extraction guidance', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toMatch(/grep.*export.*interface|grep.*export.*type|grep.*export.*function/);
    });

    test('contains file line count command', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toContain('wc -l');
    });

    test('mentions Quantitative Data subsection in output', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toContain('Quantitative Data');
    });
  });

  describe('Goal-Aligned Exploration Priority', () => {
    test('contains goal-aligned exploration section heading', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toMatch(/#+\s*Goal-Aligned Exploration/);
    });

    test('contains keyword extraction guidance', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toMatch(/[Kk]eyword/);
      // Should have a table mapping keywords to exploration areas
      expect(content).toContain('auth');
      expect(content).toContain('database');
      expect(content).toContain('API');
    });

    test('contains example with authentication goal', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      // Should have example like: goal="add authentication" -> prioritize auth/, login/, session/
      expect(content).toMatch(/add authentication/);
    });

    test('contains exploration priority order', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toMatch(/[Pp]riority [Oo]rder/);
    });

    test('contains relevance annotation guidance', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      expect(content).toMatch(/[Rr]elevance/);
    });
  });

  describe('Consistency with explorer AGENT.md', () => {
    test('quantitative section covers same metrics as AGENT.md', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      // AGENT.md has: test file count, interface signatures, line counts
      expect(content).toContain('test');
      expect(content).toContain('interface');
      expect(content).toContain('wc -l');
    });

    test('goal-aligned section covers keyword table matching AGENT.md', () => {
      content = fs.readFileSync(SKILL_PATH, 'utf-8');
      // AGENT.md has keyword mapping table with auth, database, API, test, UI, deploy
      expect(content).toContain('auth');
      expect(content).toContain('database');
      expect(content).toContain('API');
      expect(content).toContain('test');
      expect(content).toContain('UI');
      expect(content).toContain('deploy');
    });
  });
});
