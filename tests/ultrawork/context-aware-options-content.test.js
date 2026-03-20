const { describe, it, expect, beforeAll } = require("bun:test");
const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(
  __dirname,
  "../../plugins/ultrawork/skills/planning/references/context-aware-options.md"
);

describe("context-aware-options.md content requirements", () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(FILE_PATH, "utf8");
  });

  it("V17: contains Impact Analysis for Options section", () => {
    expect(content).toContain("Impact Analysis for Options");
  });

  it("V17: contains impact template with task, dependency, and risk dimensions", () => {
    expect(content).toContain("Task impact");
    expect(content).toContain("Dependency impact");
    expect(content).toContain("Risk impact");
  });

  it("V17: contains impact analysis example with concrete options", () => {
    expect(content).toContain("Option A: Use existing Prisma ORM");
    expect(content).toContain("Option B: Switch to Drizzle ORM");
  });
});
