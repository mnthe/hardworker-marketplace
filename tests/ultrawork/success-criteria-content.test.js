#!/usr/bin/env bun
/**
 * Content validation tests for success-criteria.md
 * Ensures the success criteria guide contains required patterns.
 */

const fs = require('fs');
const path = require('path');
const { describe, test, expect } = require('bun:test');

const SUCCESS_CRITERIA_PATH = path.join(
  __dirname,
  '../../plugins/ultrawork/agents/planner/references/success-criteria.md'
);

describe('success-criteria.md content validation', () => {
  let content;

  test('file exists and is readable', () => {
    content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  describe('Korean banned expressions', () => {
    test('contains "기능 동일" banned expression', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      expect(content).toContain('기능 동일');
    });

    test('contains "정상 동작" banned expression', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      expect(content).toContain('정상 동작');
    });

    test('contains "코드 정리" banned expression', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      expect(content).toContain('코드 정리');
    });

    test('contains "import 정리" banned expression', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      expect(content).toContain('import 정리');
    });
  });

  describe('Criterion-Command-Expected Output pattern', () => {
    test('contains mandatory Command column in table', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      // Must have a table with Criterion | Command | Expected Output headers
      expect(content).toMatch(/\|\s*Criterion\s*\|\s*Command\s*\|\s*Expected Output\s*\|/);
    });

    test('contains explanation that every criterion must have a command', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      expect(content).toContain('NOT optional');
    });
  });

  describe('Korean banned expressions have replacements', () => {
    test('기능 동일 has bun test replacement', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      // The line with 기능 동일 should also mention bun test
      const lines = content.split('\n');
      const relevantLine = lines.find(l => l.includes('기능 동일') && l.includes('bun test'));
      expect(relevantLine).toBeTruthy();
    });

    test('정상 동작 has curl replacement', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      const lines = content.split('\n');
      const relevantLine = lines.find(l => l.includes('정상 동작') && l.includes('curl'));
      expect(relevantLine).toBeTruthy();
    });

    test('코드 정리 has grep replacement', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      const lines = content.split('\n');
      const relevantLine = lines.find(l => l.includes('코드 정리') && l.includes('grep'));
      expect(relevantLine).toBeTruthy();
    });

    test('import 정리 has grep replacement', () => {
      content = fs.readFileSync(SUCCESS_CRITERIA_PATH, 'utf-8');
      const lines = content.split('\n');
      const relevantLine = lines.find(l => l.includes('import 정리') && l.includes('grep'));
      expect(relevantLine).toBeTruthy();
    });
  });
});
