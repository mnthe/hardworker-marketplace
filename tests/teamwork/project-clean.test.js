#!/usr/bin/env bun
/**
 * Tests for project-clean.js
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const path = require('path');
const os = require('os');
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
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
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
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TEAMWORK PROJECT CLEANED');
  });

  // Edge case tests
  test('handles already clean project (no tasks)', () => {
    const mock = mockProject({ project: 'clean-project', team: 'clean-team' });
    cleanup = mock.cleanup;

    // Clean project (no task files)
    const result = runScript(SCRIPT_PATH, {
      project: 'clean-project',
      team: 'clean-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TEAMWORK PROJECT CLEANED');

    // Verify cleaned_at timestamp added
    const projectData = JSON.parse(fs.readFileSync(mock.projectFile, 'utf-8'));
    expect(projectData.cleaned_at).toBeTruthy();
  });

  test('handles project with in_progress tasks', () => {
    const mock = mockProject({ project: 'progress-project', team: 'progress-team' });
    cleanup = mock.cleanup;

    // Create in_progress task
    const taskFile = path.join(mock.tasksDir, '1.json');
    const taskData = {
      id: '1',
      title: 'Task in progress',
      status: 'in_progress',
      claimed_by: 'session-123',
      claimed_at: new Date().toISOString()
    };
    fs.writeFileSync(taskFile, JSON.stringify(taskData));

    const result = runScript(SCRIPT_PATH, {
      project: 'progress-project',
      team: 'progress-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('TEAMWORK PROJECT CLEANED');
    expect(fs.existsSync(mock.tasksDir)).toBe(false);
  });

  test('cleans verification directory explicitly', () => {
    const mock = mockProject({ project: 'verify-project', team: 'verify-team' });
    cleanup = mock.cleanup;

    // Create verification files
    const verificationDir = path.join(mock.projectDir, 'verification');
    fs.mkdirSync(verificationDir, { recursive: true });
    fs.writeFileSync(path.join(verificationDir, 'wave-1.json'), JSON.stringify({ wave: 1 }));
    fs.writeFileSync(path.join(verificationDir, 'wave-2.json'), JSON.stringify({ wave: 2 }));

    const result = runScript(SCRIPT_PATH, {
      project: 'verify-project',
      team: 'verify-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('verification');
    expect(fs.existsSync(verificationDir)).toBe(false);
  });

  test('resets stats to zero after clean', () => {
    const mock = mockProject({ project: 'stats-project', team: 'stats-team' });
    cleanup = mock.cleanup;

    // Update stats to non-zero values
    const projectData = JSON.parse(fs.readFileSync(mock.projectFile, 'utf-8'));
    projectData.stats = { total: 10, open: 5, in_progress: 3, resolved: 2 };
    fs.writeFileSync(mock.projectFile, JSON.stringify(projectData));

    const result = runScript(SCRIPT_PATH, {
      project: 'stats-project',
      team: 'stats-team'
    }, {
      env: { ...process.env, HOME: os.tmpdir() }
    });

    expect(result.exitCode).toBe(0);

    // Verify stats reset
    const cleanedData = JSON.parse(fs.readFileSync(mock.projectFile, 'utf-8'));
    expect(cleanedData.stats.total).toBe(0);
    expect(cleanedData.stats.open).toBe(0);
    expect(cleanedData.stats.in_progress).toBe(0);
    expect(cleanedData.stats.resolved).toBe(0);
  });
});
