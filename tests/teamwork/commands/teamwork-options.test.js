import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

const COMMAND_FILE = path.join(
  process.cwd(),
  "plugins/teamwork/commands/teamwork.md"
);

describe("teamwork command options", () => {
  test("argument-hint includes --workers and --worktree options", () => {
    const content = readFileSync(COMMAND_FILE, "utf-8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    expect(frontmatterMatch).toBeTruthy();

    const frontmatter = frontmatterMatch[1];
    expect(frontmatter).toContain("argument-hint:");

    // Check for --workers in argument-hint
    expect(frontmatter).toContain("--workers");

    // Check for --worktree in argument-hint
    expect(frontmatter).toContain("--worktree");
  });

  test("has Options section documenting --workers", () => {
    const content = readFileSync(COMMAND_FILE, "utf-8");

    // Check for Options section
    expect(content).toContain("## Options");

    // Check for --workers documentation
    expect(content).toContain("### --workers");

    // Check key behaviors are documented
    expect(content).toContain("role 기반 자동 spawn"); // default behavior
    expect(content).toContain("generic worker"); // numeric option
    expect(content).toContain("role:count"); // role-specific option
    expect(content).toContain("수동 모드"); // manual mode (--workers 0)
  });

  test("has Options section documenting --worktree", () => {
    const content = readFileSync(COMMAND_FILE, "utf-8");

    // Check for --worktree documentation
    expect(content).toContain("### --worktree");

    // Check that worktree isolation is explained
    expect(content).toContain("worktree 격리");
    expect(content).toContain("파일 충돌");
  });

  test("orchestrator receives workers and worktree options", () => {
    const content = readFileSync(COMMAND_FILE, "utf-8");

    // Find Step 4 where orchestrator is spawned
    const step4Match = content.match(/## Step 4: Spawn Orchestrator.*?\n([\s\S]*?)(?=\n## Step|$)/);
    expect(step4Match).toBeTruthy();

    const step4Content = step4Match[1];

    // Check that prompt includes workers and worktree options
    expect(step4Content).toContain("workers:");
    expect(step4Content).toContain("worktree:");
  });
});
