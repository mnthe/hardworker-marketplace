#!/usr/bin/env bun
/**
 * Tests for setup-teamwork.js (v3 - native teammate based)
 */

const { test, expect, describe, afterEach } = require('bun:test');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { runScript, mockProject, TEAMWORK_TEST_BASE_DIR } = require('../test-utils.js');

const SCRIPT_PATH = path.join(__dirname, '../../plugins/teamwork/src/scripts/setup-teamwork.js');

describe('setup-teamwork.js v3', () => {
  afterEach(() => {
    // Clean up test projects
    if (fs.existsSync(TEAMWORK_TEST_BASE_DIR)) {
      fs.rmSync(TEAMWORK_TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  test('shows help with --help flag', () => {
    const result = runScript(SCRIPT_PATH, { help: '' }, {
      env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage');
    expect(result.stdout).toContain('setup-teamwork');
  });

  test('fails when CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is not set', () => {
    // Use spawnSync directly to control env precisely (runScript always merges process.env)
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TEAMWORK_TEST_BASE_DIR: TEAMWORK_TEST_BASE_DIR
    };

    const result = spawnSync('bun', [
      SCRIPT_PATH, '--project', 'test-proj', '--team', 'test-team', '--goal', 'Build API'
    ], { encoding: 'utf-8', env });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
  });

  test('fails when CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is not 1', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'test-proj',
      team: 'test-team',
      goal: 'Build API'
    }, {
      env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '0' }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS');
  });

  test('creates project directory and outputs JSON with valid params', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'my-app',
      team: 'main',
      goal: 'Build REST API'
    }, {
      env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.project).toBe('my-app');
    expect(result.json.team).toBe('main');
    expect(result.json.goal).toBe('Build REST API');

    // Verify directory was created
    const projectDir = path.join(TEAMWORK_TEST_BASE_DIR, 'my-app');
    expect(fs.existsSync(projectDir)).toBe(true);
  });

  test('fails without required --project parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      team: 'main',
      goal: 'Build API'
    }, {
      env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('fails without required --goal parameter', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'my-app',
      team: 'main'
    }, {
      env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('required');
  });

  test('output JSON includes created_at timestamp', () => {
    const result = runScript(SCRIPT_PATH, {
      project: 'ts-app',
      team: 'dev',
      goal: 'Test timestamps'
    }, {
      env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' }
    });

    expect(result.exitCode).toBe(0);
    expect(result.json).toBeTruthy();
    expect(result.json.created_at).toBeTruthy();
    // Validate ISO format
    expect(new Date(result.json.created_at).toISOString()).toBe(result.json.created_at);
  });
});
