#!/usr/bin/env bun
/**
 * wave-update.js - Update wave status in waves.json
 * Manages wave lifecycle state transitions
 *
 * Usage: wave-update.js --project <name> --team <name> --wave <wave_id> --status <status>
 */

const fs = require('fs');
const path = require('path');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectDir } = require('../lib/project-utils.js');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * @typedef {import('../lib/types.js').WaveStatus} WaveStatus
 * @typedef {import('../lib/types.js').WavesState} WavesState
 */

/**
 * @typedef {Object} CliArgs
 * @property {string} [project]
 * @property {string} [team]
 * @property {string} [wave]
 * @property {WaveStatus} [status]
 * @property {boolean} [help]
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--wave': { key: 'wave', aliases: ['-w'], required: true },
  '--status': { key: 'status', aliases: ['-s'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// Valid wave status transitions
const VALID_STATUSES = ['planning', 'in_progress', 'completed', 'verified', 'failed'];

// ============================================================================
// Wave Update Logic
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
 * Write waves.json file atomically
 * @param {string} projectDir - Project directory path
 * @param {WavesState} wavesState - Waves state to write
 * @returns {void}
 */
function writeWavesFile(projectDir, wavesState) {
  const wavesFile = path.join(projectDir, 'waves.json');

  // Update timestamp
  wavesState.updated_at = new Date().toISOString();

  // Write atomically using temp file
  const tmpFile = `${wavesFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(wavesState, null, 2), 'utf-8');
  fs.renameSync(tmpFile, wavesFile);
}

/**
 * Update wave status
 * @param {CliArgs} args - CLI arguments
 * @returns {WavesState} Updated waves state
 */
function updateWave(args) {
  const projectDir = getProjectDir(args.project, args.team);

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project not found: ${args.project}/${args.team}`);
  }

  // Validate status
  if (!VALID_STATUSES.includes(args.status)) {
    throw new Error(
      `Invalid status: ${args.status}. Must be one of: ${VALID_STATUSES.join(', ')}`
    );
  }

  // Read current state
  const wavesState = readWavesFile(projectDir);

  // Find wave
  const waveId = parseInt(args.wave, 10);
  const wave = wavesState.waves.find(w => w.id === waveId);

  if (!wave) {
    throw new Error(`Wave ${waveId} not found. Available waves: 1-${wavesState.total_waves}`);
  }

  // Update wave status
  const now = new Date().toISOString();
  const oldStatus = wave.status;
  wave.status = args.status;

  // Update timestamps based on status
  if (args.status === 'in_progress' && !wave.started_at) {
    wave.started_at = now;
    wavesState.current_wave = waveId;
  } else if (args.status === 'completed' && !wave.completed_at) {
    wave.completed_at = now;
  } else if (args.status === 'verified' && !wave.verified_at) {
    wave.verified_at = now;
  }

  // Write updated state
  writeWavesFile(projectDir, wavesState);

  console.log(`OK: Wave ${waveId} status changed ${oldStatus} → ${args.status}`);
  return wavesState;
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
        'wave-update.js',
        ARG_SPEC,
        `Update wave status in waves.json\nValid statuses: ${VALID_STATUSES.join(', ')}`
      ));
      process.exit(0);
    }

    const args = parseArgs(ARG_SPEC, process.argv);

    // Update wave
    const wavesState = updateWave(args);

    // Output updated state
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
