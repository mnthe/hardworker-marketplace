#!/usr/bin/env bun
/**
 * Project Status Script (v3 - lightweight metadata based)
 *
 * Reads project metadata from project.json and displays status.
 * Supports JSON and table output formats, field extraction.
 *
 * Usage: project-status.js --project <name> --team <name> [--format json|table] [--field <path>]
 */

const fs = require('fs');
const { parseArgs, generateHelp } = require('../lib/args.js');
const { getProjectFile } = require('../lib/project-utils.js');
const { getNestedField } = require('../lib/field-utils.js');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

const ARG_SPEC = {
  '--project': { key: 'project', aliases: ['-p'], required: true },
  '--team': { key: 'team', aliases: ['-t'], required: true },
  '--format': { key: 'format', aliases: ['-f'], default: 'table' },
  '--field': { key: 'field', aliases: [] },
  '--help': { key: 'help', aliases: ['-h'], flag: true }
};

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format project data as table
 * @param {Object} data - Project data
 * @returns {string} Formatted table output
 */
function formatTable(data) {
  const lines = [];

  lines.push('---');
  lines.push(` Project: ${data.project}`);
  lines.push(` Team:    ${data.team}`);
  lines.push(` Goal:    ${data.goal}`);
  lines.push(` Created: ${data.created_at}`);

  if (data.options) {
    lines.push(` Options: ${JSON.stringify(data.options)}`);
  }

  lines.push('---');

  return lines.join('\n');
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main execution function
 * @returns {void}
 */
function main() {
  // Check for help flag first
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(generateHelp('project-status.js', ARG_SPEC, 'Display teamwork project status'));
    process.exit(0);
  }

  const args = parseArgs(ARG_SPEC);

  // Validate format
  if (args.format && args.format !== 'json' && args.format !== 'table') {
    console.error(`Error: Invalid format: ${args.format}. Must be 'json' or 'table'`);
    process.exit(1);
  }

  // Read project metadata
  const projectFile = getProjectFile(args.project, args.team);

  if (!fs.existsSync(projectFile)) {
    console.error(`Error: Project not found: ${args.project}/${args.team}`);
    process.exit(1);
  }

  let projectData;
  try {
    const content = fs.readFileSync(projectFile, 'utf-8');
    projectData = JSON.parse(content);
  } catch (error) {
    console.error(`Error: Failed to read project.json: ${error.message}`);
    process.exit(1);
  }

  // Field query mode
  if (args.field) {
    try {
      const value = getNestedField(projectData, args.field);
      if (value === undefined) {
        throw new Error(`Field not found: ${args.field}`);
      }
      console.log(JSON.stringify(value));
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Output formatting
  if (args.format === 'json') {
    console.log(JSON.stringify(projectData, null, 2));
  } else {
    console.log(formatTable(projectData));
  }
}

// Run main and handle errors
try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
