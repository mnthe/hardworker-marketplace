#!/usr/bin/env bun
/**
 * Tests for project-status.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runScript, mockProject, assertJsonSchema } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/project-status.js');

describe('project-status.js', () => {
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
    expect(result.stdout).toContain('project-status');
  });

  test('shows project status in table format', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'table'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('test-project');
  });

  test('shows project status in JSON format', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      format: 'json'
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
      stats: 'object',
      blocked_tasks: 'array'
    });
  });

  test('extracts specific field', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team',
      field: 'stats.total'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('0');
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

  // Edge case tests
  test('handles empty project (no tasks)', () => {
    const mock = mockProject({ project: 'empty-project', team: 'empty-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'empty-project',
      team: 'empty-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json.stats.total).toBe(0);
    expect(result.json.blocked_tasks.length).toBe(0);
  });

  test('handles corrupted task files gracefully', () => {
    const mock = mockProject({ project: 'corrupt-task', team: 'corrupt-team' });
    cleanup = mock.cleanup;

    // Create valid and corrupted task files
    fs.writeFileSync(path.join(mock.tasksDir, '1.json'), JSON.stringify({ id: '1', title: 'Valid' }));
    fs.writeFileSync(path.join(mock.tasksDir, '2.json'), '{ invalid json');
    fs.writeFileSync(path.join(mock.tasksDir, '3.json'), JSON.stringify({ id: '3', title: 'Also valid' }));

    const result = runScript(SCRIPT_PATH, {
      project: 'corrupt-task',
      team: 'corrupt-team',
      format: 'json'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    // Should only count valid tasks (1 and 3)
    expect(result.json.stats.total).toBe(2);
  });

  test('handles field extraction with invalid path', () => {
    const mock = mockProject({ project: 'invalid-path', team: 'invalid-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'invalid-path',
      team: 'invalid-team',
      field: 'nonexistent.deeply.nested.field'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not found');
  });

  test('verbose mode shows task details', () => {
    const mock = mockProject({ project: 'verbose-project', team: 'verbose-team' });
    cleanup = mock.cleanup;

    // Create multiple tasks with different statuses
    for (let i = 1; i <= 5; i++) {
      const taskFile = path.join(mock.tasksDir, `${i}.json`);
      const taskData = {
        id: i.toString(),
        title: `Task ${i}`,
        status: i % 2 === 0 ? 'resolved' : 'open',
        role: 'backend',
        created_at: new Date().toISOString()
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));
    }

    const result = runScript(SCRIPT_PATH, {
      project: 'verbose-project',
      team: 'verbose-team',
      format: 'table',
      verbose: ''
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('ALL TASKS');
    expect(result.stdout).toContain('Task 1');
    expect(result.stdout).toContain('Task 5');
  });

  test('table format handles long task values', () => {
    const mock = mockProject({ project: 'long-values', team: 'long-team' });
    cleanup = mock.cleanup;

    // Create task with very long title
    const longTitle = 'A'.repeat(200);
    const taskFile = path.join(mock.tasksDir, '1.json');
    const taskData = {
      id: '1',
      title: longTitle,
      status: 'open',
      role: 'backend',
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(taskFile, JSON.stringify(taskData));

    const result = runScript(SCRIPT_PATH, {
      project: 'long-values',
      team: 'long-team',
      format: 'table'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TEAMWORK STATUS');
  });

  test('extracts nested stats field', () => {
    const mock = mockProject({ project: 'nested-stats', team: 'nested-team' });
    cleanup = mock.cleanup;

    const result = runScript(SCRIPT_PATH, {
      project: 'nested-stats',
      team: 'nested-team',
      field: 'stats.open'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('0');
  });
});
