const { describe, it, expect, beforeAll } = require("bun:test");
const fs = require("fs");
const path = require("path");

const AGENT_MD_PATH = path.join(
  __dirname,
  "../../plugins/ultrawork/agents/worker/AGENT.md"
);

describe("worker AGENT.md content requirements", () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(AGENT_MD_PATH, "utf8");
  });

  it("contains Self-Review Checklist section", () => {
    expect(content).toMatch(/Self-[Rr]eview Checklist/);
  });

  it("contains all self-review checklist items", () => {
    expect(content).toContain("All criteria verified with actual command output");
    expect(content).toContain("No blocked patterns in code");
    expect(content).toContain("Impact analysis");
    expect(content).toContain("Evidence collected for every criterion");
    expect(content).toContain("over-engineering beyond what was asked");
  });

  it("contains Evidence Status Tags section", () => {
    expect(content).toContain("Evidence Status Tags");
  });

  it("contains DONE status tag", () => {
    expect(content).toContain("STATUS: DONE");
  });

  it("contains DONE_WITH_CONCERNS status tag", () => {
    expect(content).toContain("DONE_WITH_CONCERNS");
  });

  it("contains NEEDS_CONTEXT status tag", () => {
    expect(content).toContain("NEEDS_CONTEXT");
  });

  it("describes verifier behavior for concern tags", () => {
    expect(content).toMatch(/verifier.*check.*DONE_WITH_CONCERNS|DONE_WITH_CONCERNS.*verifier/is);
    expect(content).toMatch(/NEEDS_CONTEXT.*escalat|escalat.*NEEDS_CONTEXT/is);
  });
});
