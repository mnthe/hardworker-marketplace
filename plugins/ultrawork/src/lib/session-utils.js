/**
 * Ultrawork Session Utilities — Barrel file for backward compatibility
 *
 * Re-exports all session functions from focused sub-modules.
 * Existing callers continue to `require('./session-utils.js')` unchanged.
 *
 * Sub-modules:
 *   session-paths.js      — Path resolution
 *   session-io.js         — Read/write operations, field extraction, query helpers
 *   session-validation.js — Phase transition validation
 *   session-cleanup.js    — Cleanup and safe-delete
 */

const paths = require('./session-paths.js');
const io = require('./session-io.js');
const validation = require('./session-validation.js');
const cleanup = require('./session-cleanup.js');

module.exports = {
  ...paths,
  ...io,
  ...validation,
  ...cleanup,
};
