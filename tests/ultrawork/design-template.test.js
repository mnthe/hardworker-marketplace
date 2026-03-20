const { describe, it, expect, beforeAll } = require("bun:test");
const fs = require("fs");
const path = require("path");

const TEMPLATE_PATH = path.join(
  __dirname,
  "../../plugins/ultrawork/skills/planning/references/design-template.md"
);

describe("design-template.md content requirements", () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(TEMPLATE_PATH, "utf8");
  });

  it("V1: contains Context Orientation section", () => {
    const matches = content.match(/## Context Orientation/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(1);
  });

  it("V2: contains Impact Analysis section", () => {
    const matches = content.match(/## Impact Analysis/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(1);
  });

  it("V3: contains Verification Strategy section", () => {
    const matches = content.match(/## Verification Strategy/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(1);
  });

  it("V4: contains Self-Containedness Checklist", () => {
    const matches = content.match(/Self-Containedness Checklist/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("V5: does NOT contain Testing Strategy header", () => {
    const matches = content.match(/^## Testing Strategy$/m);
    expect(matches).toBeNull();
  });

  it("V6: does NOT contain Documentation header", () => {
    const matches = content.match(/^## Documentation$/m);
    expect(matches).toBeNull();
  });

  it("V7: contains merged Assumptions & Risks section", () => {
    const matches = content.match(/^## Assumptions & Risks$/m);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(1);
  });

  it("contains Banned Criterion Patterns subsection", () => {
    expect(content).toContain("Banned Criterion Patterns");
  });

  it("contains Task Criteria Derivation Rule", () => {
    expect(content).toContain("Task Criteria Derivation Rule");
  });

  it("contains Pre-Work Verification subsection", () => {
    expect(content).toContain("Pre-Work Verification");
  });

  it("contains Problem Statement section", () => {
    expect(content).toContain("## Problem Statement");
  });

  it("contains Changed Files → Consumers table header", () => {
    expect(content).toContain("Changed Files");
    expect(content).toContain("Consumers");
  });
});
