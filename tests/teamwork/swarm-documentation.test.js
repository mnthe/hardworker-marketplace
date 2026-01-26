import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

const CLAUDE_MD_PATH = resolve(__dirname, "../../plugins/teamwork/CLAUDE.md");
const README_MD_PATH = resolve(__dirname, "../../plugins/teamwork/README.md");

describe("Swarm Documentation", () => {
  test("CLAUDE.md includes swarm scripts in Script Inventory", () => {
    const content = readFileSync(CLAUDE_MD_PATH, "utf-8");

    // Required swarm scripts
    const swarmScripts = [
      "swarm-spawn.js",
      "swarm-status.js",
      "swarm-stop.js",
      "swarm-merge.js",
      "swarm-sync.js",
      "worktree-create.js",
      "worktree-remove.js",
    ];

    for (const script of swarmScripts) {
      expect(content).toContain(script);
    }
  });

  test("CLAUDE.md includes Swarm section", () => {
    const content = readFileSync(CLAUDE_MD_PATH, "utf-8");

    // Should have a Swarm section header
    expect(content).toMatch(/##\s+Swarm/i);
  });

  test("CLAUDE.md Swarm section documents key concepts", () => {
    const content = readFileSync(CLAUDE_MD_PATH, "utf-8");

    // Should mention automatic worker spawning
    expect(content.toLowerCase()).toContain("automatic");
    expect(content.toLowerCase()).toContain("spawn");

    // Should mention tmux
    expect(content.toLowerCase()).toContain("tmux");

    // Should mention worktree
    expect(content.toLowerCase()).toContain("worktree");
  });

  test("CLAUDE.md includes swarm usage examples", () => {
    const content = readFileSync(CLAUDE_MD_PATH, "utf-8");

    // Should include examples of using swarm features
    expect(content).toMatch(/```.*swarm.*```/s);
  });

  test("Skills inventory includes swarm-workflow", () => {
    const content = readFileSync(CLAUDE_MD_PATH, "utf-8");

    // Should document swarm-workflow skill
    expect(content).toContain("swarm-workflow");
  });
});

describe("Swarm Documentation in README", () => {
  test("README.md mentions swarm options in /teamwork command", () => {
    const content = readFileSync(README_MD_PATH, "utf-8");

    // Should mention --workers option
    expect(content).toContain("--workers");

    // Should mention --worktree option
    expect(content).toContain("--worktree");
  });

  test("README.md includes swarm in command options", () => {
    const content = readFileSync(README_MD_PATH, "utf-8");

    // Should document swarm features
    expect(content.toLowerCase()).toContain("swarm");
  });
});
