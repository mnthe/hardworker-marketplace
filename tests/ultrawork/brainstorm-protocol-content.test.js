const { describe, it, expect } = require("bun:test");
const fs = require("fs");
const path = require("path");

const BRAINSTORM_PROTOCOL_PATH = path.join(
  __dirname,
  "../../plugins/ultrawork/skills/planning/references/brainstorm-protocol.md"
);

describe("brainstorm-protocol.md content", () => {
  it("contains quantitative constraints collection section", () => {
    const content = fs.readFileSync(BRAINSTORM_PROTOCOL_PATH, "utf8");
    expect(content).toContain("Quantitative Constraints Collection");
  });

  it("contains the word 'quantitative'", () => {
    const content = fs.readFileSync(BRAINSTORM_PROTOCOL_PATH, "utf8");
    const matches = (content.match(/quantitative/gi) || []).length;
    expect(matches).toBeGreaterThanOrEqual(1);
  });

  it("contains the word 'constraint'", () => {
    const content = fs.readFileSync(BRAINSTORM_PROTOCOL_PATH, "utf8");
    const matches = (content.match(/constraint/gi) || []).length;
    expect(matches).toBeGreaterThanOrEqual(1);
  });

  it("contains 'What to Collect' subsection", () => {
    const content = fs.readFileSync(BRAINSTORM_PROTOCOL_PATH, "utf8");
    expect(content).toContain("What to Collect");
  });

  it("contains 'How to Collect' subsection", () => {
    const content = fs.readFileSync(BRAINSTORM_PROTOCOL_PATH, "utf8");
    expect(content).toContain("How to Collect");
  });

  it("contains 'Where It Goes' subsection", () => {
    const content = fs.readFileSync(BRAINSTORM_PROTOCOL_PATH, "utf8");
    expect(content).toContain("Where It Goes");
  });

  it("mentions performance, quality, scale, and resource constraint categories", () => {
    const content = fs.readFileSync(BRAINSTORM_PROTOCOL_PATH, "utf8");
    expect(content).toContain("Performance constraint");
    expect(content).toContain("Quality constraint");
    expect(content).toContain("Scale constraint");
    expect(content).toContain("Resource constraint");
  });

  it("describes where constraints feed into", () => {
    const content = fs.readFileSync(BRAINSTORM_PROTOCOL_PATH, "utf8");
    expect(content).toContain("Verification Strategy");
    expect(content).toContain("Task decomposition");
    expect(content).toContain("Risk analysis");
  });
});
