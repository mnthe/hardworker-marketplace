/**
 * Type definitions for teamwork-js
 * Project state management and task tracking interfaces
 */

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task status values
 * @typedef {'open' | 'in_progress' | 'resolved'} TaskStatus
 */

/**
 * Worker role types
 * @typedef {'frontend' | 'backend' | 'devops' | 'test' | 'docs' | 'security' | 'review' | 'worker'} Role
 */

/**
 * Task definition for teamwork project
 * @typedef {Object} Task
 * @property {string} id - Unique task identifier
 * @property {string} title - Task title/subject
 * @property {string} description - Detailed task description
 * @property {Role} role - Required worker role for this task
 * @property {TaskStatus} status - Current task status
 * @property {string} created_at - ISO8601 timestamp
 * @property {string} updated_at - ISO8601 timestamp
 * @property {string | null} claimed_by - Session ID of worker that claimed this task
 * @property {string | null} [claimed_at] - ISO8601 timestamp when task was claimed
 * @property {string} [completed_at] - ISO8601 timestamp when task was resolved
 * @property {string[]} evidence - Array of evidence strings proving task completion
 */

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project statistics
 * @typedef {Object} ProjectStats
 * @property {number} total - Total number of tasks
 * @property {number} open - Number of open tasks
 * @property {number} in_progress - Number of tasks in progress
 * @property {number} resolved - Number of resolved tasks
 */

/**
 * Teamwork project session state
 * @typedef {Object} Project
 * @property {string} project - Project name
 * @property {string} team - Team name
 * @property {string} goal - Project goal description
 * @property {string} created_at - ISO8601 timestamp
 * @property {string} updated_at - ISO8601 timestamp
 * @property {ProjectStats} stats - Task statistics
 */

// ============================================================================
// Loop State Types
// ============================================================================

/**
 * Worker loop state (per-terminal)
 * @typedef {Object} LoopState
 * @property {number} pid - Process ID of the worker terminal
 * @property {string} project - Project name
 * @property {string} team - Team name
 * @property {string | null} role - Worker role filter (null = any role)
 * @property {string} started_at - ISO8601 timestamp
 * @property {string} updated_at - ISO8601 timestamp
 * @property {number} iterations - Number of loop iterations completed
 * @property {number} tasks_completed - Number of tasks completed in this loop session
 */

// Export types (for JSDoc references in other files)
module.exports = {};
