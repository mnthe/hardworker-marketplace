#!/usr/bin/env bun
/**
 * Tests for project-get.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/project-get.js');

describe('project-get.js', () => {
  let cleanup;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('project-get');
  });

  test('gets project with valid parameters', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team', goal: 'Test goal' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();

    assertJsonSchema(result.json, {
      project: 'string',
      team: 'string',
      goal: 'string',
      phase: 'string',
      created_at: 'string',
      updated_at: 'string',
      stats: 'object'
    });

    expect(result.json.project).toBe('test-project');
    expect(result.json.team).toBe('test-team');
  });

  test('fails without required parameters', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-project'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails with non-existent project', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'non-existent',
      team: 'non-existent'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('outputs full project JSON (field extraction not supported)', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team', goal: 'Test goal' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.goal).toBe('Test goal');
  });

  // Edge case tests
  test('handles corrupted project.json', () => {
    const mock = mockProject({ project: 'corrupted-project', team: 'corrupted-team' });
    cleanup = mock.cleanup;

    // Overwrite with corrupted JSON
    fs.writeFileSync(mock.projectFile, '{ "project": "test", invalid json', 'utf-8');

    const result = runScript(SCRIPT_PATH, {
      project: 'corrupted-project',
      team: 'corrupted-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBeTruthy();
  });

  test('handles project with missing fields', () => {
    const mock = mockProject({ project: 'missing-fields', team: 'missing-team' });
    cleanup = mock.cleanup;

    // Write project with missing fields
    fs.writeFileSync(mock.projectFile, JSON.stringify({ project: 'missing-fields' }), 'utf-8');

    const result = runScript(SCRIPT_PATH, {
      project: 'missing-fields',
      team: 'missing-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.project).toBe('missing-fields');
    expect(result.json.team).toBeUndefined();
  });

  test('handles project with null values', () => {
    const mock = mockProject({ project: 'null-project', team: 'null-team' });
    cleanup = mock.cleanup;

    // Write project with null values
    const projectData = {
      project: 'null-project',
      team: 'null-team',
      goal: null,
      phase: null,
      created_at: null,
      stats: null
    };
    fs.writeFileSync(mock.projectFile, JSON.stringify(projectData), 'utf-8');

    const result = runScript(SCRIPT_PATH, {
      project: 'null-project',
      team: 'null-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.goal).toBeNull();
    expect(result.json.stats).toBeNull();
  });

  test('extracts nested field with array index', () => {
    const mock = mockProject({ project: 'array-field', team: 'array-team' });
    cleanup = mock.cleanup;

    // Add array field to project
    const projectData = JSON.parse(fs.readFileSync(mock.projectFile, 'utf-8'));
    projectData.items = ['first', 'second', 'third'];
    fs.writeFileSync(mock.projectFile, JSON.stringify(projectData), 'utf-8');

    const result = runScript(SCRIPT_PATH, {
      project: 'array-field',
      team: 'array-team',
      field: 'items[1]'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('second');
  });

  test('fails with invalid field path', () => {
    const mock = mockProject({ project: 'invalid-field', team: 'invalid-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'invalid-field',
      team: 'invalid-team',
      field: 'nonexistent.nested.field'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });
});
