#!/usr/bin/env bun
/**
 * Tests for project-utils.js
 * Tests project path utilities and file operations
 */

const { test, expect, describe, beforeEach, afterEach } = require('bun:test');
const os = require('os');
const path = require('path');
const fs = require('fs');
const {
  getTeamworkBase,
  getProjectDir,
  getProjectFile,
  getTasksDir,
  getTaskFile,
  resolveProject,
  projectExists,
  listTaskIds,
  readProject,
  readTask,
  writeTask,
  writeProject,
  listTasks,
  updateProjectStats
} = require('../../../plugins/teamwork/src/lib/project-utils.js');
const { mockProject } = require('../../test-utils.js');

describe('Path Resolution', () => {
  test('getTeamworkBase returns correct path', () => {
    const base = getTeamworkBase();
    expect(base).toBe(path.join(os.homedir(), '.claude', 'teamwork'));
  });

  test('getProjectDir returns correct path', () => {
    const dir = getProjectDir('my-project', 'my-team');
    expect(dir).toBe(path.join(os.homedir(), '.claude', 'teamwork', 'my-project', 'my-team'));
  });

  test('getProjectFile returns correct path', () => {
    const file = getProjectFile('my-project', 'my-team');
    expect(file).toBe(
      path.join(os.homedir(), '.claude', 'teamwork', 'my-project', 'my-team', 'project.json')
    );
  });

  test('getTasksDir returns correct path', () => {
    const dir = getTasksDir('my-project', 'my-team');
    expect(dir).toBe(
      path.join(os.homedir(), '.claude', 'teamwork', 'my-project', 'my-team', 'tasks')
    );
  });

  test('getTaskFile returns correct path', () => {
    const file = getTaskFile('my-project', 'my-team', 'task-1');
    expect(file).toBe(
      path.join(os.homedir(), '.claude', 'teamwork', 'my-project', 'my-team', 'tasks', 'task-1.json')
    );
  });
});

describe('Project Validation', () => {
  test('projectExists returns false for non-existing project', () => {
    const exists = projectExists('non-existent-proj-xyz', 'non-existent-team-xyz');
    expect(exists).toBe(false);
  });

  test('resolveProject throws for non-existing project', () => {
    expect(() => {
      resolveProject('non-existent-proj-xyz', 'non-existent-team-xyz');
    }).toThrow('Project not found');
  });

  test('resolveProject throws when project name is missing', () => {
    expect(() => {
      resolveProject('', 'test-team');
    }).toThrow('Project name is required');
  });

  test('resolveProject throws when team name is missing', () => {
    expect(() => {
      resolveProject('test-proj', '');
    }).toThrow('Team name is required');
  });
});

describe('Task Operations', () => {
  let mock;
  const projectName = `test-proj-${Date.now()}`;
  const teamName = `test-team-${Date.now()}`;

  beforeEach(() => {
    // Create project in actual ~/.claude/teamwork location
    const projectDir = getProjectDir(projectName, teamName);
    const fs = require('fs');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(getTasksDir(projectName, teamName), { recursive: true });

    const projectData = {
      project: projectName,
      team: teamName,
      goal: 'Test project',
      phase: 'PLANNING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stats: { total: 0, open: 0, in_progress: 0, resolved: 0 }
    };
    fs.writeFileSync(
      getProjectFile(projectName, teamName),
      JSON.stringify(projectData, null, 2),
      'utf8'
    );
  });

  afterEach(() => {
    // Clean up
    const projectDir = getProjectDir(projectName, teamName);
    const fs = require('fs');
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('writeTask creates task file', () => {
    const taskData = {
      id: '1',
      title: 'Test task',
      description: 'Test description',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    };

    writeTask(projectName, teamName, '1', taskData);

    const taskFile = getTaskFile(projectName, teamName, '1');
    expect(fs.existsSync(taskFile)).toBe(true);
  });

  test('writeTask updates updated_at timestamp', () => {
    const taskData = {
      id: '1',
      title: 'Test task',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    };

    const before = new Date().toISOString();
    writeTask(projectName, teamName, '1', taskData);
    const after = new Date().toISOString();

    const written = readTask(projectName, teamName, '1');
    expect(written.updated_at).toBeDefined();
    expect(written.updated_at >= before).toBe(true);
    expect(written.updated_at <= after).toBe(true);
  });

  test('readTask retrieves task data', () => {
    const taskData = {
      id: '1',
      title: 'Test task',
      description: 'Test description',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    };

    writeTask(projectName, teamName, '1', taskData);
    const retrieved = readTask(projectName, teamName, '1');

    expect(retrieved.id).toBe('1');
    expect(retrieved.title).toBe('Test task');
    expect(retrieved.description).toBe('Test description');
  });

  test('readTask throws for non-existing task', () => {
    expect(() => {
      readTask(projectName, teamName, 'non-existent');
    }).toThrow('Task not found');
  });

  test('listTaskIds returns empty array for no tasks', () => {
    const ids = listTaskIds(projectName, teamName);
    expect(ids).toEqual([]);
  });

  test('listTaskIds returns task IDs', () => {
    writeTask(projectName, teamName, '1', {
      id: '1',
      title: 'Task 1',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    });
    writeTask(projectName, teamName, '2', {
      id: '2',
      title: 'Task 2',
      role: 'frontend',
      status: 'open',
      created_at: new Date().toISOString()
    });

    const ids = listTaskIds(projectName, teamName);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids.length).toBe(2);
  });

  test('listTasks returns all tasks', () => {
    writeTask(projectName, teamName, '1', {
      id: '1',
      title: 'Task 1',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    });
    writeTask(projectName, teamName, '2', {
      id: '2',
      title: 'Task 2',
      role: 'frontend',
      status: 'resolved',
      created_at: new Date().toISOString()
    });

    const tasks = listTasks(projectName, teamName);
    expect(tasks.length).toBe(2);
  });

  test('listTasks filters by status', () => {
    writeTask(projectName, teamName, '1', {
      id: '1',
      title: 'Task 1',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    });
    writeTask(projectName, teamName, '2', {
      id: '2',
      title: 'Task 2',
      role: 'frontend',
      status: 'resolved',
      created_at: new Date().toISOString()
    });

    const openTasks = listTasks(projectName, teamName, 'open');
    expect(openTasks.length).toBe(1);
    expect(openTasks[0].id).toBe('1');

    const resolvedTasks = listTasks(projectName, teamName, 'resolved');
    expect(resolvedTasks.length).toBe(1);
    expect(resolvedTasks[0].id).toBe('2');
  });
});

describe('Project Operations', () => {
  const projectName = `test-proj-ops-${Date.now()}`;
  const teamName = `test-team-ops-${Date.now()}`;

  beforeEach(() => {
    // Create project in actual ~/.claude/teamwork location
    const projectDir = getProjectDir(projectName, teamName);
    const fs = require('fs');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(getTasksDir(projectName, teamName), { recursive: true });

    const projectData = {
      project: projectName,
      team: teamName,
      goal: 'Test project',
      phase: 'PLANNING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stats: { total: 0, open: 0, in_progress: 0, resolved: 0 }
    };
    fs.writeFileSync(
      getProjectFile(projectName, teamName),
      JSON.stringify(projectData, null, 2),
      'utf8'
    );
  });

  afterEach(() => {
    // Clean up
    const projectDir = getProjectDir(projectName, teamName);
    const fs = require('fs');
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('readProject retrieves project data', () => {
    const project = readProject(projectName, teamName);

    expect(project.project).toBe(projectName);
    expect(project.team).toBe(teamName);
    expect(project.stats).toBeDefined();
  });

  test('writeProject updates project data', () => {
    const projectData = readProject(projectName, teamName);
    projectData.goal = 'Updated goal';

    writeProject(projectName, teamName, projectData);

    const updated = readProject(projectName, teamName);
    expect(updated.goal).toBe('Updated goal');
  });

  test('writeProject updates updated_at timestamp', () => {
    const projectData = readProject(projectName, teamName);

    const before = new Date().toISOString();
    writeProject(projectName, teamName, projectData);
    const after = new Date().toISOString();

    const updated = readProject(projectName, teamName);
    expect(updated.updated_at).toBeDefined();
    expect(updated.updated_at >= before).toBe(true);
    expect(updated.updated_at <= after).toBe(true);
  });

  test('updateProjectStats calculates correct stats', () => {
    // Create tasks with different statuses
    writeTask(projectName, teamName, '1', {
      id: '1',
      title: 'Task 1',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    });
    writeTask(projectName, teamName, '2', {
      id: '2',
      title: 'Task 2',
      role: 'frontend',
      status: 'in_progress',
      created_at: new Date().toISOString()
    });
    writeTask(projectName, teamName, '3', {
      id: '3',
      title: 'Task 3',
      role: 'devops',
      status: 'resolved',
      created_at: new Date().toISOString()
    });

    updateProjectStats(projectName, teamName);

    const project = readProject(projectName, teamName);
    expect(project.stats.total).toBe(3);
    expect(project.stats.open).toBe(1);
    expect(project.stats.in_progress).toBe(1);
    expect(project.stats.resolved).toBe(1);
  });
});
