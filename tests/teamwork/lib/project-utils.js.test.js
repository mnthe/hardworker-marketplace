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
  let mock;

  beforeEach(() => {
    mock = mockProject({ project: 'test-proj', team: 'test-team' });
  });

  afterEach(() => {
    mock.cleanup();
  });

  test('projectExists returns true for existing project', () => {
    const exists = projectExists('test-proj', 'test-team');
    expect(exists).toBe(true);
  });

  test('projectExists returns false for non-existing project', () => {
    const exists = projectExists('non-existent', 'non-existent');
    expect(exists).toBe(false);
  });

  test('resolveProject returns project file path for existing project', () => {
    const file = resolveProject('test-proj', 'test-team');
    expect(file).toBe(mock.projectFile);
  });

  test('resolveProject throws for non-existing project', () => {
    expect(() => {
      resolveProject('non-existent', 'non-existent');
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

  beforeEach(() => {
    mock = mockProject({ project: 'test-proj', team: 'test-team' });
  });

  afterEach(() => {
    mock.cleanup();
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

    writeTask('test-proj', 'test-team', '1', taskData);

    const taskFile = getTaskFile('test-proj', 'test-team', '1');
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
    writeTask('test-proj', 'test-team', '1', taskData);
    const after = new Date().toISOString();

    const written = readTask('test-proj', 'test-team', '1');
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

    writeTask('test-proj', 'test-team', '1', taskData);
    const retrieved = readTask('test-proj', 'test-team', '1');

    expect(retrieved.id).toBe('1');
    expect(retrieved.title).toBe('Test task');
    expect(retrieved.description).toBe('Test description');
  });

  test('readTask throws for non-existing task', () => {
    expect(() => {
      readTask('test-proj', 'test-team', 'non-existent');
    }).toThrow('Task not found');
  });

  test('listTaskIds returns empty array for no tasks', () => {
    const ids = listTaskIds('test-proj', 'test-team');
    expect(ids).toEqual([]);
  });

  test('listTaskIds returns task IDs', () => {
    writeTask('test-proj', 'test-team', '1', {
      id: '1',
      title: 'Task 1',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    });
    writeTask('test-proj', 'test-team', '2', {
      id: '2',
      title: 'Task 2',
      role: 'frontend',
      status: 'open',
      created_at: new Date().toISOString()
    });

    const ids = listTaskIds('test-proj', 'test-team');
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids.length).toBe(2);
  });

  test('listTasks returns all tasks', () => {
    writeTask('test-proj', 'test-team', '1', {
      id: '1',
      title: 'Task 1',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    });
    writeTask('test-proj', 'test-team', '2', {
      id: '2',
      title: 'Task 2',
      role: 'frontend',
      status: 'resolved',
      created_at: new Date().toISOString()
    });

    const tasks = listTasks('test-proj', 'test-team');
    expect(tasks.length).toBe(2);
  });

  test('listTasks filters by status', () => {
    writeTask('test-proj', 'test-team', '1', {
      id: '1',
      title: 'Task 1',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    });
    writeTask('test-proj', 'test-team', '2', {
      id: '2',
      title: 'Task 2',
      role: 'frontend',
      status: 'resolved',
      created_at: new Date().toISOString()
    });

    const openTasks = listTasks('test-proj', 'test-team', 'open');
    expect(openTasks.length).toBe(1);
    expect(openTasks[0].id).toBe('1');

    const resolvedTasks = listTasks('test-proj', 'test-team', 'resolved');
    expect(resolvedTasks.length).toBe(1);
    expect(resolvedTasks[0].id).toBe('2');
  });
});

describe('Project Operations', () => {
  let mock;

  beforeEach(() => {
    mock = mockProject({ project: 'test-proj', team: 'test-team' });
  });

  afterEach(() => {
    mock.cleanup();
  });

  test('readProject retrieves project data', () => {
    const project = readProject('test-proj', 'test-team');

    expect(project.project).toBe('test-proj');
    expect(project.team).toBe('test-team');
    expect(project.stats).toBeDefined();
  });

  test('writeProject updates project data', () => {
    const projectData = readProject('test-proj', 'test-team');
    projectData.goal = 'Updated goal';

    writeProject('test-proj', 'test-team', projectData);

    const updated = readProject('test-proj', 'test-team');
    expect(updated.goal).toBe('Updated goal');
  });

  test('writeProject updates updated_at timestamp', () => {
    const projectData = readProject('test-proj', 'test-team');

    const before = new Date().toISOString();
    writeProject('test-proj', 'test-team', projectData);
    const after = new Date().toISOString();

    const updated = readProject('test-proj', 'test-team');
    expect(updated.updated_at).toBeDefined();
    expect(updated.updated_at >= before).toBe(true);
    expect(updated.updated_at <= after).toBe(true);
  });

  test('updateProjectStats calculates correct stats', () => {
    // Create tasks with different statuses
    writeTask('test-proj', 'test-team', '1', {
      id: '1',
      title: 'Task 1',
      role: 'backend',
      status: 'open',
      created_at: new Date().toISOString()
    });
    writeTask('test-proj', 'test-team', '2', {
      id: '2',
      title: 'Task 2',
      role: 'frontend',
      status: 'in_progress',
      created_at: new Date().toISOString()
    });
    writeTask('test-proj', 'test-team', '3', {
      id: '3',
      title: 'Task 3',
      role: 'devops',
      status: 'resolved',
      created_at: new Date().toISOString()
    });

    updateProjectStats('test-proj', 'test-team');

    const project = readProject('test-proj', 'test-team');
    expect(project.stats.total).toBe(3);
    expect(project.stats.open).toBe(1);
    expect(project.stats.in_progress).toBe(1);
    expect(project.stats.resolved).toBe(1);
  });
});
