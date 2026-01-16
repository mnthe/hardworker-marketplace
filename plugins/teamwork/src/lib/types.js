#!/usr/bin/env bun
/**
 * Type definitions for teamwork
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
 * @property {number} [version] - Task version number (defaults to 0 for backward compatibility)
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

// ============================================================================
// Wave Types (Teamwork v2)
// ============================================================================

/**
 * Wave status values
 * @typedef {'planning' | 'in_progress' | 'completed' | 'verified' | 'failed'} WaveStatus
 */

/**
 * Wave definition for grouped task execution
 * @typedef {Object} Wave
 * @property {number} id - Wave number (1, 2, 3, ...)
 * @property {WaveStatus} status - Current wave status
 * @property {string[]} tasks - Task IDs included in this wave
 * @property {string} started_at - ISO8601 timestamp when wave started
 * @property {string | null} completed_at - ISO8601 timestamp when all tasks completed
 * @property {string | null} verified_at - ISO8601 timestamp when wave was verified
 */

/**
 * Waves state file
 * @typedef {Object} WavesState
 * @property {string} version - State schema version
 * @property {number} total_waves - Total number of waves in project
 * @property {number} current_wave - Currently active wave number
 * @property {Wave[]} waves - Array of wave definitions
 */

// ============================================================================
// Verification Types (Teamwork v2)
// ============================================================================

/**
 * Verification check result
 * @typedef {Object} VerificationCheck
 * @property {string} type - Check type (e.g., 'test', 'lint', 'build', 'manual')
 * @property {string} description - Check description
 * @property {'passed' | 'failed' | 'skipped'} status - Check result
 * @property {string | null} output - Command output or error message
 * @property {number | null} exit_code - Command exit code (for automated checks)
 * @property {string} timestamp - ISO8601 timestamp when check was performed
 */

/**
 * Wave verification result
 * @typedef {Object} WaveVerification
 * @property {number} wave_id - Wave number being verified
 * @property {'passed' | 'failed' | 'in_progress'} status - Overall verification status
 * @property {string} verified_at - ISO8601 timestamp when verification started
 * @property {string[]} tasks_verified - Task IDs that were verified
 * @property {VerificationCheck[]} checks - Array of verification checks performed
 * @property {string[]} issues - Array of issue descriptions (if any)
 */

// ============================================================================
// Evidence Types (Extended for Teamwork v2)
// ============================================================================

/**
 * Evidence type discriminator
 * @typedef {'command' | 'file' | 'test' | 'manual'} EvidenceType
 */

/**
 * Command execution evidence
 * @typedef {Object} CommandEvidence
 * @property {'command'} type - Evidence type
 * @property {string} command - Command that was executed
 * @property {string} output - Command output
 * @property {number} exit_code - Command exit code
 * @property {string} timestamp - ISO8601 timestamp
 */

/**
 * File operation evidence
 * @typedef {Object} FileEvidence
 * @property {'file'} type - Evidence type
 * @property {'created' | 'modified' | 'deleted'} action - File operation type
 * @property {string} path - File path (relative to project root)
 * @property {string} timestamp - ISO8601 timestamp
 */

/**
 * Test execution evidence
 * @typedef {Object} TestEvidence
 * @property {'test'} type - Evidence type
 * @property {string} test_file - Path to test file
 * @property {number} passed - Number of tests passed
 * @property {number} failed - Number of tests failed
 * @property {number} total - Total number of tests
 * @property {string} output - Test runner output
 * @property {number} exit_code - Test runner exit code
 * @property {string} timestamp - ISO8601 timestamp
 */

/**
 * Manual verification evidence
 * @typedef {Object} ManualEvidence
 * @property {'manual'} type - Evidence type
 * @property {string} description - Description of manual verification
 * @property {string} verified_by - Who verified (session ID or username)
 * @property {string} timestamp - ISO8601 timestamp
 */

/**
 * Union type for all evidence types
 * @typedef {CommandEvidence | FileEvidence | TestEvidence | ManualEvidence} Evidence
 */

/**
 * Task-level verification status
 * @typedef {Object} TaskVerification
 * @property {'passed' | 'failed' | 'pending'} status - Verification status
 * @property {string | null} verified_at - ISO8601 timestamp when verified
 * @property {string[]} criteria_met - List of criteria that were met
 * @property {string[]} criteria_unmet - List of criteria that were not met
 */

/**
 * Extended task with structured evidence (Teamwork v2)
 * @typedef {Object} ExtendedTask
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
 * @property {Evidence[]} evidence - Array of structured evidence objects
 * @property {TaskVerification} verification - Task-level verification status
 */

// Export types (for JSDoc references in other files)
module.exports = {};
