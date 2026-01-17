#!/usr/bin/env bun
/**
 * Tests for project-clean.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { runScript, mockProject } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/project-clean.js');

describe('project-clean.js', () => {
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
    expect(result.stdout).toContain('project-clean');
  });

  test('cleans project tasks and verification directories', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Create some task files
    fs.writeFileSync(path.join(mock.tasksDir, '1.json'), JSON.stringify({ id: '1' }));
    fs.writeFileSync(path.join(mock.tasksDir, '2.json'), JSON.stringify({ id: '2' }));

    // Create verification directory
    const verificationDir = path.join(mock.projectDir, 'verification');
    fs.mkdirSync(verificationDir, { recursive: true });
    fs.writeFileSync(path.join(verificationDir, 'wave-1.json'), JSON.stringify({ wave: 1 }));

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TEAMWORK PROJECT CLEANED');
    expect(result.stdout).toContain('test-project');

    // Verify directories are deleted
    expect(fs.existsSync(mock.tasksDir)).toBe(false);
    expect(fs.existsSync(verificationDir)).toBe(false);
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

  test('handles project with no tasks directory', () => {
    const mock = mockProject({ project: 'test-project', team: 'test-team' });
    cleanup = mock.cleanup;

    // Remove tasks directory
    fs.rmSync(mock.tasksDir, { recursive: true, force: true });

    const result = runScript(SCRIPT_PATH, {
      project: 'test-project',
      team: 'test-team'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TEAMWORK PROJECT CLEANED');
  });
});
