const { describe, it, expect, beforeAll } = require("bun:test");
const fs = require("fs");
const path = require("path");

const SKILL_PATH = path.join(
  __dirname,
  "../../plugins/ultrawork/skills/planning/SKILL.md"
);

describe("planning SKILL.md content requirements", () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(SKILL_PATH, "utf8");
  });

  it("V14: contains Data-Driven interview content", () => {
    const hasDataDriven = /Data-[Dd]riven/.test(content);
    expect(hasDataDriven).toBe(true);
  });

  it("V15: contains Self-Containedness check content", () => {
    const hasSelfContainedness = /[Ss]elf-[Cc]ontainedness/.test(content);
    expect(hasSelfContainedness).toBe(true);
  });

  it("contains Question Generation Rules subsection", () => {
    expect(content).toContain("Question Generation Rules");
  });

  it("contains data-driven question formula", () => {
    expect(content).toContain("탐색에서 발견한 사실");
  });

  it("contains Interview Question to Design Section Mapping table", () => {
    expect(content).toContain("Question Category");
    expect(content).toContain("Design Section");
    expect(content).toContain("Approach Selection");
    expect(content).toContain("Impact Analysis");
    expect(content).toContain("Verification Strategy");
    expect(content).toContain("Assumptions & Risks");
  });

  it("contains Self-Containedness Check checklist items", () => {
    expect(content).toContain("Context Orientation");
    expect(content).toContain("Criterion");
    expect(content).toContain("Impact Analysis");
  });
});
