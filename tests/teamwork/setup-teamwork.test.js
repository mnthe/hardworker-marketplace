#!/usr/bin/env bun
/**
 * Tests for setup-teamwork.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, createTempDir } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/setup-teamwork.js');

describe('setup-teamwork.js', () => {
  let tempDir;

  beforeEach(() => {
    const temp = createTempDir('teamwork-test-');
    tempDir = temp.path;
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('setup-teamwork');
  });

  test('initializes teamwork project with goal', () => {
    const result = runScript(SCRIPT_PATH, {}, {
      cwd: tempDir,
      env: { ...process.env, HOME: tempDir }
    });

    // Add goal as positional argument
    const args = [SCRIPT_PATH, 'Build', 'test', 'app'];
    const { spawnSync } = require('child_process');
    const result2 = spawnSync('bun', args, {
      encoding: 'utf-8',
      cwd: tempDir,
      env: { ...process.env, HOME: tempDir }
    });

    expect(result2.status).toBe(0);
    expect(result2.stdout).toContain('TEAMWORK PROJECT INITIALIZED');
    expect(result2.stdout).toContain('TEAMWORK_DIR=');
  });

  test('accepts custom project name', () => {
    const args = [SCRIPT_PATH, '--project', 'custom-project', 'Build', 'API'];
    const { spawnSync } = require('child_process');
    const result = spawnSync('bun', args, {
      encoding: 'utf-8',
      cwd: tempDir,
      env: { ...process.env, HOME: tempDir }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Project: custom-project');
  });

  test('fails without goal argument', () => {
    const result = runScript(SCRIPT_PATH, {}, {
      cwd: tempDir,
      env: { ...process.env, HOME: tempDir }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No goal provided');
  });

  test('creates directory structure', () => {
    const args = [SCRIPT_PATH, '--project', 'test-proj', '--team', 'test-team', 'Test', 'goal'];
    const { spawnSync } = require('child_process');
    const result = spawnSync('bun', args, {
      encoding: 'utf-8',
      cwd: tempDir,
      env: { ...process.env, HOME: tempDir }
    });

    expect(result.status).toBe(0);

    const projectDir = path.join(tempDir, '.claude', 'teamwork', 'test-proj', 'test-team');
    const tasksDir = path.join(projectDir, 'tasks');

    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(tasksDir)).toBe(true);
  });
});
