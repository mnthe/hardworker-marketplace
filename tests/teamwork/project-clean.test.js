#!/usr/bin/env bun
/**
 * Tests for project-clean.js (v3 - delete metadata directory)
 */

const { test, expect, describe, afterEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/project-clean.js');

describe('project-clean.js v3', () => {
  afterEach(() => {
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('project-clean');
  });

  test('deletes project metadata directory', () => {
    // Create a project directory with metadata
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'clean-test', 'dev');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'clean-test',
      team: 'dev',
      goal: 'To be cleaned',
      created_at: new Date().toISOString()
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'clean-test',
      team: 'dev'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('clean-test');

    // Verify the project directory was deleted
    expect(fs.existsSync(projectDir)).toBe(false);
  });

  test('outputs confirmation message', () => {
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'confirm-test', 'main');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'confirm-test',
      team: 'main',
      goal: 'Confirm message test',
      created_at: new Date().toISOString()
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'confirm-test',
      team: 'main'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('cleaned');
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails with non-existent project', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'non-existent',
      team: 'non-existent'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('deletes project with nested subdirectories', () => {
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'nested-test', 'dev');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'nested-test',
      team: 'dev',
      goal: 'Nested test',
      created_at: new Date().toISOString()
    }));

    // Create nested subdirectories (simulating old state that might remain)
    const subDir = path.join(projectDir, 'sub', 'deep');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'data.json'), '{}');

    const result = runScript(SCRIPT_PATH, {
      project: 'nested-test',
      team: 'dev'
    });

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(projectDir)).toBe(false);
  });

  test('outputs JSON with cleanup details', () => {
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'json-clean', 'dev');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'json-clean',
      team: 'dev',
      goal: 'JSON clean test',
      created_at: new Date().toISOString()
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'json-clean',
      team: 'dev'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.project).toBe('json-clean');
    expect(result.json.team).toBe('dev');
    expect(result.json.cleaned_at).toBeTruthy();
  });
});
