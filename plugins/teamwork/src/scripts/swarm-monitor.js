#!/usr/bin/env bun
/**
 * Swarm Monitor Script
 * Monitors tmux panes and auto-responds to prompts
 *
 * Usage: swarm-monitor.js --project <name> --team <name> [--interval <seconds>]
 *
 * Auto-responds to:
 * - "shift+Tab to cycle" prompts (AskUserQuestion)
 * - Dead panes (respawns worker)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir } = require('../lib/project-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--interval': { key: 'interval', aliases: ['-i'], default: '5' },
  '--once': { key: 'once', flag: true },
  '--verbose': { key: 'verbose', aliases: ['-v'], flag: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Prompt Detection Patterns
// ============================================================================

const PROMPT_PATTERNS = [
  { pattern: 'shift+Tab to cycle', action: 'enter', description: 'AskUserQuestion prompt' },
  { pattern: '(Y/n)', action: 'enter', description: 'Yes/No confirmation' },
  { pattern: '(y/N)', action: 'n', description: 'No/Yes confirmation (default no)' },
  { pattern: 'Press Enter to continue', action: 'enter', description: 'Continue prompt' },
  { pattern: '? Select', action: 'enter', description: 'Selection prompt' }
];

// ============================================================================
// tmux Operations
// ============================================================================

/**
 * Get swarm state
 * @param {string} project
 * @param {string} team
 * @returns {Object|null}
 */
function getSwarmState(project, team) {
  const swarmFile = path.join(getProjectDir(project, team), 'swarm', 'swarm.json');

  if (!fs.existsSync(swarmFile)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(swarmFile, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Check if tmux session exists
 * @param {string} sessionName
 * @returns {boolean}
 */
function sessionExists(sessionName) {
  const result = spawnSync('tmux', ['has-session', '-t', sessionName], {
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  return result.status === 0;
}

/**
 * Get all panes in a session
 * @param {string} sessionName
 * @returns {Array<{index: number, dead: boolean, command: string}>}
 */
function getPanes(sessionName) {
  try {
    const output = execSync(
      `tmux list-panes -t "${sessionName}" -F "#{pane_index}:#{pane_dead}:#{pane_current_command}"`,
      { encoding: 'utf-8' }
    );

    return output.trim().split('\n').map(line => {
      const parts = line.split(':');
      return {
        index: parseInt(parts[0], 10),
        dead: parts[1] === '1',
        command: parts.slice(2).join(':') || 'unknown'
      };
    });
  } catch {
    return [];
  }
}

/**
 * Capture pane content (last N lines)
 * @param {string} sessionName
 * @param {number} paneIndex
 * @param {number} lines
 * @returns {string}
 */
function capturePaneContent(sessionName, paneIndex, lines = 10) {
  try {
    return execSync(
      `tmux capture-pane -t "${sessionName}:main.${paneIndex}" -p | tail -${lines}`,
      { encoding: 'utf-8' }
    );
  } catch {
    return '';
  }
}

/**
 * Send keys to a pane
 * @param {string} sessionName
 * @param {number} paneIndex
 * @param {string} keys
 */
function sendKeys(sessionName, paneIndex, keys) {
  const target = `${sessionName}:main.${paneIndex}`;

  if (keys === 'enter') {
    spawnSync('tmux', ['send-keys', '-t', target, 'Enter'], { encoding: 'utf-8' });
  } else {
    spawnSync('tmux', ['send-keys', '-t', target, keys, 'Enter'], { encoding: 'utf-8' });
  }
}

/**
 * Respawn a dead pane
 * @param {string} sessionName
 * @param {number} paneIndex
 */
function respawnPane(sessionName, paneIndex) {
  try {
    execSync(`tmux respawn-pane -t "${sessionName}:main.${paneIndex}" -k`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// Monitor Logic
// ============================================================================

/**
 * Check and handle prompts in a pane
 * @param {string} sessionName
 * @param {number} paneIndex
 * @param {boolean} verbose
 * @returns {Object|null} Action taken or null
 */
function checkAndHandlePane(sessionName, paneIndex, verbose) {
  const content = capturePaneContent(sessionName, paneIndex);

  for (const { pattern, action, description } of PROMPT_PATTERNS) {
    if (content.includes(pattern)) {
      sendKeys(sessionName, paneIndex, action);

      return {
        pane: paneIndex,
        pattern,
        action,
        description
      };
    }
  }

  return null;
}

/**
 * Monitor all panes in a session
 * @param {string} sessionName
 * @param {boolean} verbose
 * @returns {Array} Actions taken
 */
function monitorSession(sessionName, verbose) {
  const actions = [];

  if (!sessionExists(sessionName)) {
    return actions;
  }

  const panes = getPanes(sessionName);

  for (const pane of panes) {
    if (pane.dead) {
      // Respawn dead pane
      respawnPane(sessionName, pane.index);
      actions.push({
        pane: pane.index,
        action: 'respawn',
        description: 'Dead pane respawned'
      });
      continue;
    }

    // Check for prompts
    const action = checkAndHandlePane(sessionName, pane.index, verbose);
    if (action) {
      actions.push(action);
    }
  }

  return actions;
}

/**
 * Run one monitoring cycle
 * @param {string} project
 * @param {string} team
 * @param {boolean} verbose
 * @returns {Object} Results
 */
function runMonitorCycle(project, team, verbose) {
  const swarmState = getSwarmState(project, team);

  if (!swarmState) {
    return { error: 'Swarm not found' };
  }

  const sessionName = swarmState.session;
  const actions = monitorSession(sessionName, verbose);

  return {
    session: sessionName,
    timestamp: new Date().toISOString(),
    actions_taken: actions.length,
    actions
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  // Check for help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp(
      'swarm-monitor.js',
      ARG_SPEC,
      'Monitor tmux panes and auto-respond to prompts\n\n' +
      'Auto-responds to:\n' +
      '  - AskUserQuestion prompts (shift+Tab to cycle)\n' +
      '  - Yes/No confirmations\n' +
      '  - Dead panes (respawns)\n\n' +
      'Examples:\n' +
      '  swarm-monitor.js --project my-app --team master           # Run continuously\n' +
      '  swarm-monitor.js --project my-app --team master --once    # Run once\n' +
      '  swarm-monitor.js --project my-app --team master -i 3 -v   # 3s interval, verbose'
    ));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);
  const interval = parseInt(args.interval, 10) * 1000;

  if (args.once) {
    // Run once and exit
    const result = runMonitorCycle(args.project, args.team, args.verbose);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Continuous monitoring
  console.log(`Starting monitor for ${args.project}/${args.team} (interval: ${args.interval}s)`);
  console.log('Press Ctrl+C to stop\n');

  const runCycle = () => {
    const result = runMonitorCycle(args.project, args.team, args.verbose);

    if (result.actions_taken > 0) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] ${result.actions_taken} action(s):`);
      for (const action of result.actions) {
        console.log(`  - Pane ${action.pane}: ${action.description} (${action.action})`);
      }
    } else if (args.verbose) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] No actions needed`);
    }
  };

  // Initial run
  runCycle();

  // Continuous loop
  setInterval(runCycle, interval);
}

// Run
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
