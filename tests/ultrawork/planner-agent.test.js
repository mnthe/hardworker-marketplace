const { describe, it, expect, beforeAll } = require("bun:test");
const fs = require("fs");
const path = require("path");

const AGENT_PATH = path.join(
  __dirname,
  "../../plugins/ultrawork/agents/planner/AGENT.md"
);

describe("planner AGENT.md content requirements", () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(AGENT_PATH, "utf8");
  });

  it("V16: contains Data Collection, Quantitative, or Self-Containedness", () => {
    const matches = content.match(
      /Data Collection|Quantitative|Self-Containedness/g
    );
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("references Data Collection step after Read Context", () => {
    expect(content).toContain("Data Collection");
  });

  it("references Quantitative data from explorers", () => {
    expect(content).toContain("Quantitative");
  });

  it("references Self-Containedness Check step", () => {
    expect(content).toContain("Self-Containedness");
  });

  it("references Context Orientation section", () => {
    expect(content).toContain("Context Orientation");
  });

  it("references Impact Analysis section", () => {
    expect(content).toContain("Impact Analysis");
  });

  it("references Verification Strategy section", () => {
    expect(content).toContain("Verification Strategy");
  });

  it("notes task criteria derived from Verification Strategy table", () => {
    expect(content).toContain("Verification Strategy");
    // The document should state that criteria come from the Verification Strategy table
    const hasCriteriaDerivation = content.match(
      /criter.*Verification Strategy|Verification Strategy.*criter/i
    );
    expect(hasCriteriaDerivation).not.toBeNull();
  });
});
