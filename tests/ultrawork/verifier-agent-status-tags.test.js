const { readFileSync } = require("fs");
const { join } = require("path");
const { describe, it, expect, beforeAll } = require("bun:test");

const AGENT_MD_PATH = join(
  __dirname,
  "../../plugins/ultrawork/agents/verifier/AGENT.md"
);

describe("verifier AGENT.md - Evidence Status Tag Processing", () => {
  let content;

  beforeAll(() => {
    content = readFileSync(AGENT_MD_PATH, "utf-8");
  });

  it("contains DONE_WITH_CONCERNS tag handling", () => {
    expect(content).toContain("DONE_WITH_CONCERNS");
  });

  it("contains NEEDS_CONTEXT tag handling", () => {
    expect(content).toContain("NEEDS_CONTEXT");
  });

  it("has an Evidence Status Tag Processing section", () => {
    expect(content).toContain("Evidence Status Tag Processing");
  });

  it("defines critical vs minor concern classification", () => {
    expect(content).toContain("Critical");
    expect(content).toContain("Minor");
  });

  it("describes fix task creation for NEEDS_CONTEXT", () => {
    // NEEDS_CONTEXT should result in a fix task
    const needsContextIndex = content.indexOf("NEEDS_CONTEXT");
    const afterNeedsContext = content.slice(needsContextIndex);
    expect(afterNeedsContext).toContain("fix task");
  });
});
