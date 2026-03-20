const { describe, it, expect, beforeAll } = require("bun:test");
const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(
  __dirname,
  "../../plugins/ultrawork/agents/planner/references/task-decomposition.md"
);

describe("task-decomposition.md enhancements", () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(FILE_PATH, "utf8");
  });

  it("V10: contains Verification Strategy section", () => {
    const count = (content.match(/Verification Strategy/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("V11: contains Create / Modify / Test file classification", () => {
    // Check for the pattern where Create, Modify, Test appear together as a classification
    const hasClassification =
      /Create.*Modify.*Test/s.test(content) ||
      /Create \/ Modify \/ Test/.test(content);
    expect(hasClassification).toBe(true);
  });

  it("contains Worker Criteria Format Rules section", () => {
    const hasSection = content.includes("Worker Criteria Format Rules");
    expect(hasSection).toBe(true);
  });

  it("contains banned criteria list", () => {
    // The banned criteria section should list vague criteria that are not allowed
    const hasBanned = content.includes("기능 동일") && content.includes("정상 동작") && content.includes("코드 정리");
    expect(hasBanned).toBe(true);
  });

  it("contains verifiable pattern table", () => {
    // Should have patterns like test -f, grep -c, exit code
    const hasPatterns =
      content.includes("test -f") &&
      content.includes("grep -c") &&
      content.includes("exit code");
    expect(hasPatterns).toBe(true);
  });

  it("contains File Classification section with Create/Modify/Test categories", () => {
    const hasFileClassification = content.includes("## File Classification");
    expect(hasFileClassification).toBe(true);
  });
});
