#!/usr/bin/env bun

/**
 * Common argument parsing utility for ultrawork plugin scripts.
 * Provides consistent CLI argument handling with alias support.
 *
 * @example
 * import { parseArgs } from '../lib/args.js';
 *
 * const args = parseArgs({
 *   '--session': { key: 'session', aliases: ['-s'], required: true },
 *   '--format': { key: 'format', aliases: ['-f'], default: 'table' },
 *   '--help': { key: 'help', aliases: ['-h'], flag: true }
 * });
 */

/**
 * @typedef {Object} ArgSpec
 * @property {string} key - The key name in the returned args object
 * @property {string[]} [aliases] - All aliases for this argument (e.g., ['-s', '--sess'] for '--session')
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
 *   '--session': { key: 'session', aliases: ['-s'], required: true },
 *   '--task': { key: 'taskId', aliases: ['-t', '--id'] },
 *   '--verbose': { key: 'verbose', aliases: ['-v'], flag: true }
 * });
 *
 * // With custom argv
 * const args = parseArgs(spec, ['node', 'script.js', '--session', 'abc']);
 */
function parseArgs(spec, argv = process.argv) {
    const args = {};

    // Build alias map: alias -> primary flag
    const aliasMap = {};
    for (const [flag, opt] of Object.entries(spec)) {
        if (opt.aliases) {
            for (const alias of opt.aliases) {
                aliasMap[alias] = flag;
            }
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
            if (i + 1 >= argv.length) {
                console.error(`Error: ${arg} requires a value`);
                process.exit(1);
            }
            args[opt.key] = argv[++i];
        }
    }

    // Validate required arguments
    for (const [flag, opt] of Object.entries(spec)) {
        if (opt.required && args[opt.key] === undefined) {
            const aliasInfo = opt.aliases?.length > 0 ? ` (${opt.aliases[0]})` : '';
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
function generateHelp(scriptName, spec, description = '') {
    let help = `Usage: ${scriptName} [options]\n`;
    if (description) {
        help += `\n${description}\n`;
    }
    help += '\nOptions:\n';

    for (const [flag, opt] of Object.entries(spec)) {
        const aliases = opt.aliases?.length > 0 ? `, ${opt.aliases.join(', ')}` : '';
        const required = opt.required ? ' (required)' : '';
        const defaultVal = opt.default !== undefined ? ` [default: ${opt.default}]` : '';
        const flagType = opt.flag ? '' : ' <value>';
        help += `  ${flag}${aliases}${flagType}${required}${defaultVal}\n`;
    }

    return help;
}

/**
 * Validate that a task ID is a positive integer.
 * Prevents path traversal attacks (e.g., "../../etc/passwd").
 *
 * @param {string} id - Task ID to validate
 * @returns {string} Validated task ID
 */
function validateTaskId(id) {
    if (!/^\d+$/.test(String(id))) {
        console.error(`Error: Invalid task ID "${id}". Task ID must be a positive integer.`);
        process.exit(1);
    }
    return String(id);
}

module.exports = { parseArgs, generateHelp, validateTaskId };
