#!/usr/bin/env bun

/**
 * Project Clean Script
 * Deletes task and verification directories, updates project.json with cleaned_at timestamp
 */

const fs = require('fs');
const path = require('path');
const { getProjectFile, getProjectDir, readProject, writeProject } = require('../lib/project-utils.js');
const { parseArgs, generateHelp } = require('../lib/args.js');

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * @typedef {Object} CliArgs
 * @property {string} project
 * @property {string} team
 * @property {boolean} help
 */

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Clean Project
// ============================================================================

/**
 * Recursively delete directory
 * @param {string} dirPath - Directory path to delete
 * @returns {void}
 */
function deleteDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      deleteDirectory(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
  }

  fs.rmdirSync(dirPath);
}

/**
 * Clean a project by deleting task and verification directories
 * @param {string} project - Project name
 * @param {string} team - Team name
 * @returns {Promise<void>}
 */
async function cleanProject(project, team) {
  const projectFile = getProjectFile(project, team);

  if (!fs.existsSync(projectFile)) {
    console.error(`❌ Project ${project}/${team} not found.`);
    process.exit(1);
  }

  /** @type {import('../lib/types.js').Project} */
  let projectData;
  try {
    projectData = readProject(project, team);
  } catch (error) {
    console.error(`❌ Failed to read project: ${error}`);
    process.exit(1);
  }

  // Check if already cleaned
  if (projectData.cleaned_at && projectData.cleaned_at !== null) {
    console.log(`Project ${project}/${team} already cleaned at ${projectData.cleaned_at}`);
    process.exit(0);
  }

  const timestamp = new Date().toISOString();
  const projectDir = getProjectDir(project, team);

  // Directories to delete
  const dirsToDelete = ['tasks', 'verification', 'workers'];
  const deletedDirs = [];

  // Delete directories
  for (const dirName of dirsToDelete) {
    const dirPath = path.join(projectDir, dirName);
    try {
      if (fs.existsSync(dirPath)) {
        deleteDirectory(dirPath);
        deletedDirs.push(dirName);
      }
    } catch (error) {
      console.error(`❌ Failed to delete ${dirName}/ directory: ${error}`);
      process.exit(1);
    }
  }

  // Update project with cleaned_at timestamp
  try {
    await writeProject(project, team, {
      ...projectData,
      cleaned_at: timestamp,
      updated_at: timestamp,
      stats: {
        total: 0,
        open: 0,
        in_progress: 0,
        resolved: 0
      }
    });
  } catch (error) {
    console.error(`❌ Failed to update project: ${error}`);
    process.exit(1);
  }

  // Output cleanup message
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' TEAMWORK PROJECT CLEANED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(` Project: ${project}/${team}`);
  console.log(` Goal: ${projectData.goal}`);
  console.log(` Created: ${projectData.created_at}`);
  console.log(` Cleaned: ${timestamp}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  console.log(' Deleted directories:');
  if (deletedDirs.length > 0) {
    for (const dirName of deletedDirs) {
      console.log(` - ${dirName}/`);
    }
  } else {
    console.log(' (no directories found)');
  }
  console.log('');
  console.log(' Project metadata preserved in:');
  console.log(` ${projectFile}`);
  console.log('');
  console.log(' Start fresh with:');
  console.log(` /teamwork --project "${project}" --team "${team}"`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

// ============================================================================
// Main
// ============================================================================

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  // Check for help flag first (before validation)
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('project-clean.js', ARG_SPEC, 'Clean teamwork project by deleting task and verification directories'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  const { project, team } = args;

  await cleanProject(project, team);
}

main().catch((error) => {
  console.error(`❌ Unexpected error: ${error}`);
  process.exit(1);
});
