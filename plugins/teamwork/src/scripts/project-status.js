#!/usr/bin/env bun
/**
 * project-status.js - Comprehensive status dashboard for teamwork projects
 * Displays project progress, task statistics, wave status, and active workers
 *
 * Usage: project-status.js --project <name> --team <name> [--format json|table] [--field path] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir, getProjectFile, getTasksDir, listTaskIds, readTask, readProject } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').Project} Project
 * @typedef {import('../lib/types.js').Task} Task
 * @typedef {import('../lib/types.js').TaskStatus} TaskStatus
 * @typedef {import('../lib/types.js').WavesState} WavesState
 * @typedef {import('../lib/types.js').Wave} Wave
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} project
 * @property {string} team
 * @property {'json'|'table'} [format]
 * @property {string} [field]
 * @property {boolean} [verbose]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--format': { key: 'format', aliases: ['-f'], default: 'table' },
  '--field': { key: 'field', aliases: [] },
  '--verbose': { key: 'verbose', aliases: ['-v'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Data Collection
// ============================================================================

/**
 * Read waves.json if it exists
 * @param {string} projectDir - Project directory path
 * @returns {WavesState | null} Waves state or null if not found
 */
function readWavesFile(projectDir) {
  const wavesFile = path.join(projectDir, 'waves.json');

  if (!fs.existsSync(wavesFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(wavesFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Read verification results if they exist
 * @param {string} projectDir - Project directory path
 * @returns {Object.<string, any>} Verification results by wave ID
 */
function readVerificationResults(projectDir) {
  const verificationDir = path.join(projectDir, 'verification');
  const results = {};

  if (!fs.existsSync(verificationDir)) {
    return results;
  }

  try {
    const files = fs.readdirSync(verificationDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(verificationDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          const waveId = file.replace('.json', '');
          results[waveId] = data;
        } catch {
          // Skip invalid verification files
          continue;
        }
      }
    }
  } catch {
    // Skip if directory read fails
  }

  return results;
}

/**
 * Collect all project data
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Object} Combined project data
 */
function collectProjectData(project, team) {
  const projectDir = getProjectDir(project, team);

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project not found: ${project}/${team}`);
  }

  // Read project metadata
  let projectData;
  try {
    projectData = readProject(project, team);
  } catch (error) {
    throw new Error(`Failed to read project.json: ${error.message}`);
  }

  // Read all tasks
  const taskIds = listTaskIds(project, team);
  const tasks = [];
  for (const taskId of taskIds) {
    try {
      const task = readTask(project, team, taskId);
      tasks.push(task);
    } catch {
      // Skip invalid task files
      continue;
    }
  }

  // Read waves (optional)
  const wavesState = readWavesFile(projectDir);

  // Read verification results (optional)
  const verificationResults = readVerificationResults(projectDir);

  return {
    project: projectData,
    tasks,
    waves: wavesState,
    verification: verificationResults
  };
}

// ============================================================================
// Statistics Calculation
// ============================================================================

/**
 * Calculate task statistics
 * @param {Task[]} tasks - Array of tasks
 * @returns {Object} Task statistics
 */
function calculateTaskStats(tasks) {
  const stats = {
    total: tasks.length,
    open: 0,
    in_progress: 0,
    resolved: 0,
    by_role: {},
    active_workers: []
  };

  for (const task of tasks) {
    // Count by status
    if (task.status === 'open') {
      stats.open++;
    } else if (task.status === 'in_progress') {
      stats.in_progress++;
    } else if (task.status === 'resolved') {
      stats.resolved++;
    }

    // Count by role
    if (!stats.by_role[task.role]) {
      stats.by_role[task.role] = { total: 0, resolved: 0 };
    }
    stats.by_role[task.role].total++;
    if (task.status === 'resolved') {
      stats.by_role[task.role].resolved++;
    }

    // Track active workers - only include in_progress tasks (not resolved historical claims)
    if (task.status === 'in_progress' && task.claimed_by) {
      const worker = {
        session: task.claimed_by,
        task_id: task.id,
        task_title: task.title,
        claimed_at: task.claimed_at
      };
      stats.active_workers.push(worker);
    }
  }

  // Calculate progress percentage
  stats.progress = stats.total > 0
    ? Math.round((stats.resolved / stats.total) * 100)
    : 0;

  return stats;
}

/**
 * Calculate wave statistics
 * @param {WavesState | null} wavesState - Waves state
 * @param {Task[]} tasks - Array of tasks
 * @returns {Object | null} Wave statistics or null if no waves
 */
function calculateWaveStats(wavesState, tasks) {
  if (!wavesState) {
    return null;
  }

  const waveStats = {
    total_waves: wavesState.total_waves,
    current_wave: wavesState.current_wave,
    waves: []
  };

  for (const wave of wavesState.waves) {
    const waveTasks = tasks.filter(t => wave.tasks.includes(t.id));
    const resolvedCount = waveTasks.filter(t => t.status === 'resolved').length;
    const inProgressCount = waveTasks.filter(t => t.status === 'in_progress').length;
    const openCount = waveTasks.filter(t => t.status === 'open').length;

    const progress = waveTasks.length > 0
      ? Math.round((resolvedCount / waveTasks.length) * 100)
      : 0;

    waveStats.waves.push({
      id: wave.id,
      status: wave.status,
      total_tasks: waveTasks.length,
      resolved: resolvedCount,
      in_progress: inProgressCount,
      open: openCount,
      progress,
      started_at: wave.started_at,
      completed_at: wave.completed_at,
      verified_at: wave.verified_at,
      tasks: waveTasks
    });
  }

  return waveStats;
}

/**
 * Find blocked tasks
 * @param {Task[]} tasks - Array of tasks
 * @returns {Task[]} Blocked tasks
 */
function findBlockedTasks(tasks) {
  return tasks.filter(task => {
    if (!task.blocked_by || task.blocked_by.length === 0) {
      return false;
    }

    // Check if any blocker is not resolved
    for (const blockerId of task.blocked_by) {
      const blocker = tasks.find(t => t.id === blockerId);
      if (!blocker || blocker.status !== 'resolved') {
        return true;
      }
    }

    return false;
  });
}

// ============================================================================
// Output Formatting - JSON
// ============================================================================

/**
 * Format status as JSON
 * @param {Object} data - Combined project data
 * @param {Object} stats - Calculated statistics
 * @param {Object | null} waveStats - Wave statistics
 * @param {Object} verification - Verification results
 * @param {Task[]} blockedTasks - Blocked tasks
 * @returns {Object} JSON output
 */
function formatJSON(data, stats, waveStats, verification, blockedTasks) {
  const output = {
    project: data.project.project,
    team: data.project.team,
    goal: data.project.goal,
    phase: data.project.phase,
    stats,
    blocked_tasks: blockedTasks.map(t => ({
      id: t.id,
      title: t.title,
      blocked_by: t.blocked_by
    }))
  };

  if (waveStats) {
    output.waves = waveStats;
  }

  if (Object.keys(verification).length > 0) {
    output.verification = verification;
  }

  return output;
}

// ============================================================================
// Output Formatting - Table/Dashboard
// ============================================================================

/**
 * Get status icon
 * @param {string} status - Status value
 * @returns {string} Status icon
 */
function getStatusIcon(status) {
  const icons = {
    resolved: '✓',
    in_progress: '◐',
    open: '○',
    blocked: '⊘',
    verified: '✅',
    completed: '✅',
    planning: '⏸️',
    in_progress_wave: '⏳',
    failed: '❌'
  };
  return icons[status] || '?';
}

/**
 * Create progress bar
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} width - Bar width in characters
 * @returns {string} Progress bar string
 */
function createProgressBar(percentage, width = 20) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format status as table/dashboard
 * @param {Object} data - Combined project data
 * @param {Object} stats - Calculated statistics
 * @param {Object | null} waveStats - Wave statistics
 * @param {Object} verification - Verification results
 * @param {Task[]} blockedTasks - Blocked tasks
 * @param {boolean} verbose - Show verbose output
 * @returns {string} Formatted table output
 */
function formatTable(data, stats, waveStats, verification, blockedTasks, verbose) {
  const lines = [];

  // Header
  lines.push('═'.repeat(63));
  lines.push(' TEAMWORK STATUS');
  lines.push('═'.repeat(63));
  lines.push('');
  lines.push(` Project: ${data.project.project}`);
  lines.push(` Sub-team: ${data.project.team}`);
  lines.push(` Goal: ${data.project.goal}`);
  if (data.project.phase) {
    lines.push(` Phase: ${data.project.phase}`);
  }
  lines.push('');

  // Progress section
  lines.push('─'.repeat(63));
  lines.push(' PROGRESS');
  lines.push('─'.repeat(63));
  lines.push('');
  lines.push(` ${createProgressBar(stats.progress)} ${stats.progress}% (${stats.resolved}/${stats.total})`);
  lines.push('');
  lines.push(` Open:        ${stats.open} tasks`);
  lines.push(` In Progress: ${stats.in_progress} tasks`);
  lines.push(` Completed:   ${stats.resolved} tasks`);
  lines.push('');

  // Wave progress section (if waves exist)
  if (waveStats) {
    lines.push('─'.repeat(63));
    lines.push(' WAVE PROGRESS');
    lines.push('─'.repeat(63));
    lines.push('');

    for (const wave of waveStats.waves) {
      let statusIcon;
      if (wave.status === 'verified') {
        statusIcon = '✅';
      } else if (wave.status === 'completed') {
        statusIcon = '✅';
      } else if (wave.status === 'in_progress') {
        statusIcon = '⏳';
      } else if (wave.status === 'planning') {
        statusIcon = '⏸️';
      } else if (wave.status === 'failed') {
        statusIcon = '❌';
      } else {
        statusIcon = '○';
      }

      const statusLabel = wave.status.toUpperCase();
      lines.push(` Wave ${wave.id}: ${statusIcon} ${statusLabel.padEnd(12)} (${wave.resolved}/${wave.total_tasks} tasks, ${wave.progress}%)`);

      if (verbose) {
        for (const task of wave.tasks) {
          const taskIcon = getStatusIcon(task.status);
          const claimedInfo = task.claimed_by ? ` (${task.claimed_by.substring(0, 8)})` : '';
          lines.push(`         Task ${task.id}: ${taskIcon} ${task.status.padEnd(12)} ${task.title}${claimedInfo}`);
        }
      }
    }

    lines.push('');
    lines.push(` Overall: Wave ${waveStats.current_wave}/${waveStats.total_waves} active`);
    lines.push('');
  }

  // Verification section (if verification results exist)
  if (Object.keys(verification).length > 0) {
    lines.push('─'.repeat(63));
    lines.push(' VERIFICATION');
    lines.push('─'.repeat(63));
    lines.push('');

    for (const [waveId, result] of Object.entries(verification)) {
      const statusIcon = result.status === 'passed' ? '✅' : '❌';
      const statusLabel = result.status === 'passed' ? 'PASS' : 'FAIL';
      const timestamp = result.verified_at ? new Date(result.verified_at).toLocaleString() : 'Unknown';

      lines.push(` ${waveId}: ${statusIcon} ${statusLabel} (verified ${timestamp})`);

      if (verbose && result.checks) {
        for (const check of result.checks) {
          const checkIcon = check.status === 'passed' ? '✓' : '✗';
          lines.push(`         ${checkIcon} ${check.name}`);
          if (check.evidence) {
            lines.push(`           ${check.evidence}`);
          }
        }
      }

      if (result.issues && result.issues.length > 0) {
        for (const issue of result.issues) {
          lines.push(`         ⚠️  ${issue}`);
        }
      }
    }

    lines.push('');
  }

  // By role section
  lines.push('─'.repeat(63));
  lines.push(' BY ROLE');
  lines.push('─'.repeat(63));
  lines.push('');

  for (const [role, roleStats] of Object.entries(stats.by_role)) {
    const percentage = roleStats.total > 0
      ? Math.round((roleStats.resolved / roleStats.total) * 100)
      : 0;
    const bar = createProgressBar(percentage);
    const status = percentage === 100 ? ' ✓' : '';
    lines.push(` ${role.padEnd(10)} ${bar} ${percentage.toString().padStart(3)}% (${roleStats.resolved}/${roleStats.total})${status}`);
  }

  lines.push('');

  // Active workers section
  if (stats.active_workers.length > 0) {
    lines.push('─'.repeat(63));
    lines.push(' ACTIVE WORKERS');
    lines.push('─'.repeat(63));
    lines.push('');

    for (const worker of stats.active_workers) {
      const sessionShort = worker.session.substring(0, 12);
      const timeAgo = worker.claimed_at ? formatTimeAgo(worker.claimed_at) : 'unknown time';
      lines.push(` ${sessionShort}: #${worker.task_id} ${worker.task_title} (${timeAgo})`);
    }

    lines.push('');
  }

  // Blocked tasks section
  if (blockedTasks.length > 0) {
    lines.push('─'.repeat(63));
    lines.push(' BLOCKED TASKS');
    lines.push('─'.repeat(63));
    lines.push('');

    for (const task of blockedTasks) {
      const blockers = task.blocked_by.join(', ');
      lines.push(` #${task.id} ${task.title} - blocked by: ${blockers}`);
    }

    lines.push('');
  }

  // Commands section
  lines.push('─'.repeat(63));
  lines.push(' COMMANDS');
  lines.push('─'.repeat(63));
  lines.push('');
  lines.push(' /teamwork-worker              Start working on tasks');
  lines.push(' /teamwork-worker --loop       Continuous worker mode');
  if (waveStats) {
    lines.push(' /teamwork-worker --strict     Strict evidence mode (for waves)');
  }
  lines.push(' /teamwork-status --verbose    Show task details');
  lines.push('');

  lines.push('═'.repeat(63));

  // Verbose task list
  if (verbose) {
    lines.push('');
    lines.push('─'.repeat(63));
    lines.push(' ALL TASKS');
    lines.push('─'.repeat(63));
    lines.push('');
    lines.push('| ID | Status | Role | Task | Owner |');
    lines.push('|----|--------|------|------|-------|');

    for (const task of data.tasks) {
      const statusIcon = getStatusIcon(task.status);
      const owner = task.claimed_by ? task.claimed_by.substring(0, 8) : '-';
      lines.push(`| ${task.id.padEnd(2)} | ${statusIcon}      | ${task.role.padEnd(10).substring(0, 10)} | ${task.title.substring(0, 30)} | ${owner} |`);
    }

    lines.push('');
    lines.push('Legend: ✓ resolved, ◐ in progress, ○ open, ⊘ blocked');
  }

  return lines.join('\n');
}

/**
 * Format time ago string
 * @param {string} isoTimestamp - ISO timestamp
 * @returns {string} Human-readable time ago
 */
function formatTimeAgo(isoTimestamp) {
  try {
    const now = Date.now();
    const then = new Date(isoTimestamp).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1m ago';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1h ago';
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1d ago';
    return `${diffDays}d ago`;
  } catch {
    return 'unknown';
  }
}

// ============================================================================
// Field Query
// ============================================================================

/**
 * Query field from data object
 * @param {Object} data - Data object
 * @param {string} fieldPath - Dot-separated field path (e.g., "stats.total")
 * @returns {any} Field value
 */
function queryField(data, fieldPath) {
  const parts = fieldPath.split('.');
  let value = data;

  for (const part of parts) {
    if (value === null || value === undefined) {
      throw new Error(`Field not found: ${fieldPath}`);
    }
    value = value[part];
  }

  return value;
}

// ============================================================================
// Main Logic
// ============================================================================

/**
 * Display project status
 * @param {CliArgs} args - CLI arguments
 * @returns {void}
 */
function displayStatus(args) {
  // Collect data
  const data = collectProjectData(args.project, args.team);

  // Calculate statistics
  const stats = calculateTaskStats(data.tasks);
  const waveStats = calculateWaveStats(data.waves, data.tasks);
  const blockedTasks = findBlockedTasks(data.tasks);

  // Prepare full data object for field queries
  const fullData = {
    project: data.project,
    stats,
    waves: waveStats,
    verification: data.verification,
    blocked_tasks: blockedTasks
  };

  // Field query mode
  if (args.field) {
    try {
      const value = queryField(fullData, args.field);
      console.log(JSON.stringify(value));
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Output formatting
  if (args.format === 'json') {
    const output = formatJSON(data, stats, waveStats, data.verification, blockedTasks);
    console.log(JSON.stringify(output, null, 2));
  } else {
    const output = formatTable(data, stats, waveStats, data.verification, blockedTasks, args.verbose);
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
        'project-status.js',
        ARG_SPEC,
        'Display comprehensive status dashboard for teamwork project'
      ));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

    // Validate format
    if (args.format && args.format !== 'json' && args.format !== 'table') {
      throw new Error(`Invalid format: ${args.format}. Must be 'json' or 'table'`);
    }

    // Display status
    displayStatus(args);

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
