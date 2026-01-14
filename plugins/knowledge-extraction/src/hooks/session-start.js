#!/usr/bin/env bun

/**
 * Session Start Hook
 *
 * Captures process.cwd() at session initialization and stores in working-dirs.json
 *
 * Storage: ~/.claude/knowledge-extraction/working-dirs.json
 * Format: { session_id: working_dir, ... }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// Configuration
// ============================================================================

const BASE_DIR = path.join(os.homedir(), '.claude', 'knowledge-extraction');
const WORKING_DIRS_FILE = path.join(BASE_DIR, 'working-dirs.json');

// ============================================================================
// Utilities
// ============================================================================

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return chunks.join('');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadWorkingDirs() {
  if (!fs.existsSync(WORKING_DIRS_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(WORKING_DIRS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveWorkingDirs(data) {
  ensureDir(BASE_DIR);
  fs.writeFileSync(WORKING_DIRS_FILE, JSON.stringify(data, null, 2));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    const input = await readStdin();

    let hookInput = {};
    try {
      hookInput = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    const sessionId = hookInput.session_id;

    if (!sessionId) {
      process.exit(0);
    }

    // Capture current working directory
    const workingDir = process.cwd();

    // Load existing working directories
    const workingDirs = loadWorkingDirs();

    // Add or update this session's working directory
    workingDirs[sessionId] = workingDir;

    // Save to file
    saveWorkingDirs(workingDirs);

    // Output confirmation
    const output = {
      additionalContext: `📍 Working directory captured: ${workingDir}`
    };
    console.log(JSON.stringify(output));

    process.exit(0);
  } catch (error) {
    // Fail silently
    process.exit(0);
  }
}

main();
