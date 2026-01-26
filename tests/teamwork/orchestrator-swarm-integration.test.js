import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";
import path from "path";

/**
 * Test suite for Orchestrator Swarm Integration
 *
 * Verifies that orchestrator AGENT.md includes swarm-related tools
 * and has swarm workflow documentation.
 */

const ORCHESTRATOR_PATH = path.join(
  __dirname,
  "../../plugins/teamwork/agents/orchestrator/AGENT.md"
);

describe("Orchestrator Swarm Integration", () => {
  test("orchestrator AGENT.md includes swarm script tools", () => {
    const content = readFileSync(ORCHESTRATOR_PATH, "utf-8");

    // Extract frontmatter tools array
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatterMatch).toBeTruthy();

    const frontmatter = frontmatterMatch[1];

    // Check for swarm-*.js pattern in tools
    expect(frontmatter).toContain("swarm-*.js");

    // Check for worktree-*.js pattern in tools
    expect(frontmatter).toContain("worktree-*.js");
  });

  test("orchestrator AGENT.md documents swarm monitoring loop", () => {
    const content = readFileSync(ORCHESTRATOR_PATH, "utf-8");

    // Check for Swarm Monitoring Loop section
    expect(content).toContain("## Swarm Monitoring Loop");

    // Check for key swarm concepts
    expect(content).toContain("swarm-spawn");
    expect(content).toContain("swarm-status");
    expect(content).toContain("swarm-merge");
    expect(content).toContain("swarm-sync");

    // Check for Wave completion handling
    expect(content).toContain("Wave completion");
  });

  test("orchestrator AGENT.md references swarm-workflow skill", () => {
    const content = readFileSync(ORCHESTRATOR_PATH, "utf-8");

    // Extract frontmatter skills array
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatterMatch).toBeTruthy();

    const frontmatter = frontmatterMatch[1];

    // Check for swarm-workflow skill reference
    expect(frontmatter).toContain("swarm-workflow");
  });

  test("swarm-workflow SKILL.md exists", () => {
    const skillPath = path.join(
      __dirname,
      "../../plugins/teamwork/skills/swarm-workflow/SKILL.md"
    );

    // Check file exists
    const exists = require("fs").existsSync(skillPath);
    expect(exists).toBe(true);
  });

  test("swarm-workflow SKILL.md has required sections", () => {
    const skillPath = path.join(
      __dirname,
      "../../plugins/teamwork/skills/swarm-workflow/SKILL.md"
    );

    const content = readFileSync(skillPath, "utf-8");

    // Check for key sections
    expect(content).toContain("## Swarm Spawn Decision");
    expect(content).toContain("## Wave Completion Detection");
    expect(content).toContain("## Merge/Sync Workflow");
    expect(content).toContain("## Error Handling");
  });
});
