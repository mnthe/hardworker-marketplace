#!/usr/bin/env bun
/**
 * Tests for project-status.js (v3 - lightweight metadata based)
 */

const { test, expect, describe, afterEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/project-status.js');

describe('project-status.js v3', () => {
  afterEach(() => {
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('project-status');
  });

  test('shows project status in JSON format', () => {
    // Create a mock project using the v3 metadata format
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'json-proj', 'dev');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'json-proj',
      team: 'dev',
      goal: 'Build API',
      created_at: new Date().toISOString()
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'json-proj',
      team: 'dev',
      format: 'json'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();

    assertJsonSchema(result.json, {
      project: 'string',
      team: 'string',
      goal: 'string',
      created_at: 'string'
    });
  });

  test('shows project status in table format', () => {
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'table-proj', 'dev');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'table-proj',
      team: 'dev',
      goal: 'Build frontend',
      created_at: new Date().toISOString()
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'table-proj',
      team: 'dev',
      format: 'table'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('table-proj');
    expect(result.stdout).toContain('Build frontend');
  });

  test('defaults to table format when no format specified', () => {
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'default-proj', 'main');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'default-proj',
      team: 'main',
      goal: 'Default test',
      created_at: new Date().toISOString()
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'default-proj',
      team: 'main'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('default-proj');
  });

  test('extracts specific field with --field', () => {
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'field-proj', 'dev');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'field-proj',
      team: 'dev',
      goal: 'Field test',
      created_at: '2026-01-01T00:00:00.000Z'
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'field-proj',
      team: 'dev',
      field: 'goal'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toContain('Field test');
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

  test('handles field extraction with invalid path', () => {
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'invalid-field', 'dev');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'invalid-field',
      team: 'dev',
      goal: 'Test',
      created_at: new Date().toISOString()
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'invalid-field',
      team: 'dev',
      field: 'nonexistent.deeply.nested'
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('JSON format includes options if present', () => {
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'opts-proj', 'dev');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      project: 'opts-proj',
      team: 'dev',
      goal: 'Options test',
      created_at: new Date().toISOString(),
      options: { workers: 3 }
    }));

    const result = runScript(SCRIPT_PATH, {
      project: 'opts-proj',
      team: 'dev',
      format: 'json'
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.options).toBeTruthy();
    expect(result.json.options.workers).toBe(3);
  });
});
