#!/usr/bin/env bun
/**
 * Tests for setup-teamwork.js
 */

const { test, expect, describe, afterAll } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { runScript, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/setup-teamwork.js');

describe('setup-teamwork.js', () => {
  afterAll(() => {
    // Clean up test projects
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('setup-teamwork');
  });

  test('initializes teamwork project with goal', () => {
    // Add goal as positional argument
    const args = [SCRIPT_PATH, 'Build', 'test', 'app'];
    const result = spawnSync('bun', args, {
      encoding: 'utf-8',
      env: { ...process.env, TEAMWORK_TEST_BASE_DIR }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('TEAMWORK PROJECT INITIALIZED');
    expect(result.stdout).toContain('TEAMWORK_DIR=');
  });

  test('accepts custom project name', () => {
    const args = [SCRIPT_PATH, '--project', 'custom-project', 'Build', 'API'];
    const result = spawnSync('bun', args, {
      encoding: 'utf-8',
      env: { ...process.env, TEAMWORK_TEST_BASE_DIR }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Project: custom-project');
  });

  test('fails without goal argument', () => {
    const result = runScript(SCRIPT_PATH, {});

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No goal provided');
  });

  test('creates directory structure', () => {
    const args = [SCRIPT_PATH, '--project', 'test-proj', '--team', 'test-team', 'Test', 'goal'];
    const result = spawnSync('bun', args, {
      encoding: 'utf-8',
      env: { ...process.env, TEAMWORK_TEST_BASE_DIR }
    });

    expect(result.status).toBe(0);

    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'test-proj', 'test-team');
    const tasksDir = path.join(projectDir, 'tasks');

    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(tasksDir)).toBe(true);
  });
});
