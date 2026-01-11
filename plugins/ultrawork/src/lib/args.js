#!/usr/bin/env bun

/**
 * Common argument parsing utility for ultrawork plugin scripts.
 * Provides consistent CLI argument handling with alias support.
 *
 * @example
 * import { parseArgs } from '../lib/args.js';
 *
 * const args = parseArgs({
 *   '--session': { key: 'session', alias: '-s', required: true },
 *   '--format': { key: 'format', alias: '-f', default: 'table' },
 *   '--help': { key: 'help', alias: '-h', flag: true }
 * });
 */

/**
 * @typedef {Object} ArgSpec
 * @property {string} key - The key name in the returned args object
 * @property {string} [alias] - Short alias (e.g., '-s' for '--session')
 * @property {boolean} [required] - Whether this argument is required
 * @property {*} [default] - Default value if not provided
 * @property {boolean} [flag] - If true, argument is a boolean flag (no value)
 */

/**
 * Parse command line arguments based on specification.
 *
 * @param {Object.<string, ArgSpec>} spec - Argument specifications
 * @param {string[]} [argv=process.argv] - Argument array to parse
 * @returns {Object} Parsed arguments object
 *
 * @example
 * // Basic usage
 * const args = parseArgs({
 *   '--session': { key: 'session', alias: '-s', required: true },
 *   '--task': { key: 'taskId', alias: '-t' },
 *   '--verbose': { key: 'verbose', alias: '-v', flag: true }
 * });
 *
 * // With custom argv
 * const args = parseArgs(spec, ['node', 'script.js', '--session', 'abc']);
 */
export function parseArgs(spec, argv = process.argv) {
    const args = {};

    // Build alias map: alias -> primary flag
    const aliasMap = {};
    for (const [flag, opt] of Object.entries(spec)) {
        if (opt.alias) {
            aliasMap[opt.alias] = flag;
        }
    }

    // Set default values
    for (const [, opt] of Object.entries(spec)) {
        if (opt.default !== undefined) {
            args[opt.key] = opt.default;
        }
        if (opt.flag) {
            args[opt.key] = false;
        }
    }

    // Parse arguments
    for (let i = 2; i < argv.length; i++) {
        let arg = argv[i];

        // Resolve alias to primary flag
        if (aliasMap[arg]) {
            arg = aliasMap[arg];
        }

        const opt = spec[arg];
        if (!opt) continue;

        if (opt.flag) {
            args[opt.key] = true;
        } else {
            args[opt.key] = argv[++i];
        }
    }

    // Validate required arguments
    for (const [flag, opt] of Object.entries(spec)) {
        if (opt.required && args[opt.key] === undefined) {
            const aliasInfo = opt.alias ? ` (${opt.alias})` : '';
            console.error(`Error: ${flag}${aliasInfo} is required`);
            process.exit(1);
        }
    }

    return args;
}

/**
 * Generate help text from argument specification.
 *
 * @param {string} scriptName - Name of the script
 * @param {Object.<string, ArgSpec>} spec - Argument specifications
 * @param {string} [description] - Script description
 * @returns {string} Formatted help text
 */
export function generateHelp(scriptName, spec, description = '') {
    let help = `Usage: ${scriptName} [options]\n`;
    if (description) {
        help += `\n${description}\n`;
    }
    help += '\nOptions:\n';

    for (const [flag, opt] of Object.entries(spec)) {
        const alias = opt.alias ? `, ${opt.alias}` : '';
        const required = opt.required ? ' (required)' : '';
        const defaultVal = opt.default !== undefined ? ` [default: ${opt.default}]` : '';
        const flagType = opt.flag ? '' : ' <value>';
        help += `  ${flag}${alias}${flagType}${required}${defaultVal}\n`;
    }

    return help;
}
