/**
 * Test: interview-rounds.md contains Quantitative Constraints Collection section
 *
 * Verifies that the interview-rounds.md reference file includes
 * quantitative constraint collection guidance (SLA, latency, coverage targets).
 */
const { readFileSync } = require('fs');
const path = require('path');
const { describe, it, expect, beforeAll } = require('bun:test');

const INTERVIEW_ROUNDS_PATH = path.join(
  __dirname,
  '../../plugins/ultrawork/skills/planning/references/interview-rounds.md'
);

describe('interview-rounds.md Quantitative Constraints', () => {
  let content;

  beforeAll(() => {
    content = readFileSync(INTERVIEW_ROUNDS_PATH, 'utf-8');
  });

  it('contains "Quantitative Constraints Collection" section header', () => {
    expect(content).toContain('## Quantitative Constraints Collection');
  });

  it('contains quantitative constraint types table', () => {
    expect(content).toContain('Constraint Type');
    expect(content).toContain('Example Question');
    expect(content).toContain("How It's Used");
  });

  it('includes Performance SLA constraint', () => {
    expect(content).toContain('Performance SLA');
    expect(content).toContain('acceptable response time');
  });

  it('includes Coverage target constraint', () => {
    expect(content).toContain('Coverage target');
    expect(content).toContain('coverage');
  });

  it('includes Latency budget constraint', () => {
    expect(content).toContain('Latency budget');
    expect(content).toContain('latency');
  });

  it('includes Scale requirements constraint', () => {
    expect(content).toContain('Scale requirements');
    expect(content).toContain('concurrent users');
  });

  it('includes Data volume constraint', () => {
    expect(content).toContain('Data volume');
    expect(content).toContain('records in the table');
  });

  it('contains Collection Rules section', () => {
    expect(content).toContain('### Collection Rules');
    expect(content).toContain('quantitative constraints per interview');
    expect(content).toContain('measurable criteria');
    expect(content).toContain('Verification Strategy');
  });
});
