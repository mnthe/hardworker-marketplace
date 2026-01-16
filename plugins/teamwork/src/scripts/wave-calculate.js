#!/usr/bin/env bun
/**
 * wave-calculate.js - Calculate wave groupings from task dependencies
 * Uses Kahn's topological sort to group tasks into parallel execution waves
 *
 * Usage: wave-calculate.js --project <name> --team <name>
 */

const fs = require('fs');
const path = require('path');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir, getTasksDir } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Wave} Wave
 * @typedef {import('../lib/types.js').WavesState} WavesState
 * @typedef {import('../lib/types.js').Task} Task
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} [project]
 * @property {string} [team]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Wave Calculation (Kahn's Algorithm)
// ============================================================================

/**
 * Calculate waves using topological sort (Kahn's algorithm)
 * @param {string} projectDir - Project directory path
 * @returns {WavesState} Waves state with calculated waves
 */
function calculateWaves(projectDir) {
  const tasksDir = path.join(projectDir, 'tasks');

  if (!fs.existsSync(tasksDir)) {
    throw new Error(`Tasks directory not found: ${tasksDir}`);
  }

  // Read all task files
  const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));

  if (taskFiles.length === 0) {
    throw new Error(`No tasks found in ${tasksDir}`);
  }

  /** @type {Map<string, Task>} */
  const tasks = new Map();

  // Load all tasks
  for (const file of taskFiles) {
    const taskPath = path.join(tasksDir, file);
    const content = fs.readFileSync(taskPath, 'utf-8');
    const task = JSON.parse(content);
    tasks.set(task.id, task);
  }

  // Build dependency graph
  /** @type {Map<string, Set<string>>} */
  const graph = new Map(); // task -> dependents (tasks that depend on this task)
  /** @type {Map<string, number>} */
  const inDegree = new Map(); // task -> number of dependencies

  // Initialize graph
  for (const [taskId] of tasks) {
    graph.set(taskId, new Set());
    inDegree.set(taskId, 0);
  }

  // Build edges: if task A is blocked_by task B, then B -> A
  for (const [taskId, task] of tasks) {
    const blockedBy = task.blocked_by || [];
    inDegree.set(taskId, blockedBy.length);

    for (const depId of blockedBy) {
      if (!tasks.has(depId)) {
        console.warn(`Warning: Task ${taskId} depends on non-existent task ${depId}`);
        continue;
      }

      if (!graph.has(depId)) {
        graph.set(depId, new Set());
      }
      graph.get(depId).add(taskId);
    }
  }

  // Kahn's algorithm: topological sort into waves
  /** @type {Wave[]} */
  const waves = [];
  let waveNum = 1;
  let remaining = new Set(tasks.keys());

  while (remaining.size > 0) {
    // Find all tasks with in-degree 0 (no remaining dependencies)
    const ready = [];
    for (const taskId of remaining) {
      if (inDegree.get(taskId) === 0) {
        ready.push(taskId);
      }
    }

    if (ready.length === 0) {
      // Circular dependency detected
      const remainingTasks = Array.from(remaining).join(', ');
      throw new Error(`Circular dependency detected in tasks: ${remainingTasks}`);
    }

    // Create wave with ready tasks
    const wave = {
      id: waveNum,
      status: 'planning',
      tasks: ready.sort(), // Sort for deterministic output
      started_at: null,
      completed_at: null,
      verified_at: null
    };
    waves.push(wave);

    // Remove ready tasks and update in-degrees
    for (const taskId of ready) {
      remaining.delete(taskId);

      // Decrease in-degree for dependent tasks
      const dependents = graph.get(taskId) || new Set();
      for (const depId of dependents) {
        const currentDegree = inDegree.get(depId);
        inDegree.set(depId, currentDegree - 1);
      }
    }

    waveNum++;
  }

  // Build WavesState
  const now = new Date().toISOString();
  /** @type {WavesState} */
  const wavesState = {
    version: '1',
    total_waves: waves.length,
    current_wave: 1,
    waves: waves,
    created_at: now,
    updated_at: now
  };

  return wavesState;
}

/**
 * Write waves.json file
 * @param {string} projectDir - Project directory path
 * @param {WavesState} wavesState - Waves state to write
 * @returns {void}
 */
function writeWavesFile(projectDir, wavesState) {
  const wavesFile = path.join(projectDir, 'waves.json');

  // Write atomically using temp file
  const tmpFile = `${wavesFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(wavesState, null, 2), 'utf-8');
  fs.renameSync(tmpFile, wavesFile);
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  try {
    // Check for help flag first
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(generateHelp(
        'wave-calculate.js',
        ARG_SPEC,
        'Calculate wave groupings from task dependencies using topological sort'
      ));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

    // Get project directory from project-utils
    const projectDir = getProjectDir(args.project, args.team);

    if (!fs.existsSync(projectDir)) {
      throw new Error(`Project not found: ${args.project}/${args.team}`);
    }

    // Calculate waves
    const wavesState = calculateWaves(projectDir);

    // Write waves.json
    writeWavesFile(projectDir, wavesState);

    // Output success message and result
    console.log(`OK: Calculated ${wavesState.total_waves} waves`);
    console.log(JSON.stringify(wavesState, null, 2));

  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error: Unknown error occurred');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
