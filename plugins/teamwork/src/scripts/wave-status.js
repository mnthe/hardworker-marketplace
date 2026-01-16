#!/usr/bin/env bun
/**
 * wave-status.js - Display wave progress and current status
 * Shows wave execution progress with task details
 *
 * Usage: wave-status.js --dir <project_dir> [--format json|table]
 */

const fs = require('fs');
const path = require('path');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').WavesState} WavesState
 * @typedef {import('../lib/types.js').Wave} Wave
 * @typedef {import('../lib/types.js').Task} Task
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} [dir]
 * @property {'json' | 'table'} [format]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--dir': { key: 'dir', aliases: ['-d'], required: true },
  '--format': { key: 'format', aliases: ['-f'], default: 'table' },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Status Display Logic
// ============================================================================

/**
 * Read waves.json file
 * @param {string} projectDir - Project directory path
 * @returns {WavesState} Waves state
 */
function readWavesFile(projectDir) {
  const wavesFile = path.join(projectDir, 'waves.json');

  if (!fs.existsSync(wavesFile)) {
    throw new Error(`waves.json not found in ${projectDir}. Run wave-calculate.js first.`);
  }

  const content = fs.readFileSync(wavesFile, 'utf-8');
  return JSON.parse(content);
}

/**
 * Read task details
 * @param {string} projectDir - Project directory path
 * @param {string} taskId - Task ID
 * @returns {Task | null} Task data or null if not found
 */
function readTask(projectDir, taskId) {
  const taskFile = path.join(projectDir, 'tasks', `${taskId}.json`);

  if (!fs.existsSync(taskFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(taskFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Status icon mapping
 * @param {string} status - Status value
 * @returns {string} Status icon
 */
function getStatusIcon(status) {
  const icons = {
    planning: '⏱️',
    in_progress: '🔄',
    completed: '✅',
    verified: '🎯',
    failed: '❌',
    open: '⚪',
    resolved: '✅'
  };
  return icons[status] || '❓';
}

/**
 * Format wave progress as table
 * @param {string} projectDir - Project directory path
 * @param {WavesState} wavesState - Waves state
 * @returns {string} Formatted table output
 */
function formatTable(projectDir, wavesState) {
  let output = [];

  output.push('');
  output.push('='.repeat(80));
  output.push(`WAVE PROGRESS (${wavesState.total_waves} waves)`);
  output.push(`Current Wave: ${wavesState.current_wave}`);
  output.push('='.repeat(80));
  output.push('');

  for (const wave of wavesState.waves) {
    const statusIcon = getStatusIcon(wave.status);
    const isCurrent = wave.id === wavesState.current_wave ? '👉 ' : '   ';

    output.push(`${isCurrent}Wave ${wave.id}: ${statusIcon} ${wave.status.toUpperCase()}`);
    output.push(`   Tasks: ${wave.tasks.join(', ')}`);

    if (wave.started_at) {
      output.push(`   Started: ${wave.started_at}`);
    }

    if (wave.completed_at) {
      output.push(`   Completed: ${wave.completed_at}`);
    }

    if (wave.verified_at) {
      output.push(`   Verified: ${wave.verified_at}`);
    }

    // Show task details
    for (const taskId of wave.tasks) {
      const task = readTask(projectDir, taskId);
      if (task) {
        const taskIcon = getStatusIcon(task.status);
        output.push(`      ${taskIcon} Task ${taskId}: ${task.title || 'Untitled'} (${task.status})`);
      } else {
        output.push(`      ⚠️  Task ${taskId}: Not found`);
      }
    }

    output.push('');
  }

  output.push('-'.repeat(80));

  // Summary statistics
  const completed = wavesState.waves.filter(w => w.status === 'completed' || w.status === 'verified').length;
  const inProgress = wavesState.waves.filter(w => w.status === 'in_progress').length;
  const remaining = wavesState.waves.filter(w => w.status === 'planning').length;

  output.push(`Summary: ${completed} completed | ${inProgress} in progress | ${remaining} remaining`);
  output.push('-'.repeat(80));

  return output.join('\n');
}

/**
 * Format wave progress as JSON
 * @param {string} projectDir - Project directory path
 * @param {WavesState} wavesState - Waves state
 * @returns {Object} Formatted JSON output
 */
function formatJSON(projectDir, wavesState) {
  const wavesWithTasks = wavesState.waves.map(wave => {
    const tasks = wave.tasks.map(taskId => {
      const task = readTask(projectDir, taskId);
      return task ? {
        id: task.id,
        title: task.title,
        status: task.status,
        role: task.role
      } : {
        id: taskId,
        title: 'Not found',
        status: 'unknown',
        role: null
      };
    });

    return {
      ...wave,
      task_details: tasks
    };
  });

  const completed = wavesState.waves.filter(w => w.status === 'completed' || w.status === 'verified').length;
  const inProgress = wavesState.waves.filter(w => w.status === 'in_progress').length;
  const remaining = wavesState.waves.filter(w => w.status === 'planning').length;

  return {
    total_waves: wavesState.total_waves,
    current_wave: wavesState.current_wave,
    summary: {
      completed,
      in_progress: inProgress,
      remaining
    },
    waves: wavesWithTasks
  };
}

/**
 * Display wave status
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function displayWaveStatus(args) {
  const projectDir = path.resolve(args.dir);

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory not found: ${projectDir}`);
  }

  // Read waves state
  const wavesState = readWavesFile(projectDir);

  // Format output
  if (args.format === 'json') {
    const output = formatJSON(projectDir, wavesState);
    console.log(JSON.stringify(output, null, 2));
  } else {
    const output = formatTable(projectDir, wavesState);
    console.log(output);
  }
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
        'wave-status.js',
        ARG_SPEC,
        'Display wave progress and current status'
      ));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

    // Validate format
    if (args.format !== 'json' && args.format !== 'table') {
      throw new Error(`Invalid format: ${args.format}. Must be 'json' or 'table'`);
    }

    // Display status
    displayWaveStatus(args);

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
