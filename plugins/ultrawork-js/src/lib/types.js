/**
 * Type definitions for ultrawork-ts
 * Session state management and task tracking interfaces
 */

// ============================================================================
// Session Types
// ============================================================================

/**
 * @typedef {'PLANNING' | 'EXECUTION' | 'VERIFICATION' | 'COMPLETE' | 'CANCELLED' | 'FAILED' | 'unknown'} Phase
 */

/**
 * @typedef {'not_started' | 'overview' | 'analyzing' | 'targeted' | 'complete'} ExplorationStage
 */

/**
 * @typedef {Object} SessionOptions
 * @property {number} max_workers
 * @property {number} max_iterations
 * @property {boolean} skip_verify
 * @property {boolean} plan_only
 * @property {boolean} auto_mode
 */

/**
 * @typedef {Object} Session
 * @property {string} version
 * @property {string} session_id
 * @property {string} working_dir
 * @property {string} goal
 * @property {string} started_at
 * @property {string} updated_at
 * @property {Phase} phase
 * @property {ExplorationStage} exploration_stage
 * @property {number} iteration
 * @property {{ approved_at: string | null }} plan
 * @property {SessionOptions} options
 * @property {EvidenceEntry[]} evidence_log
 * @property {string | null} cancelled_at
 */

// ============================================================================
// Task Types
// ============================================================================

/**
 * @typedef {'pending' | 'in_progress' | 'resolved' | 'blocked' | 'open'} TaskStatus
 */

/**
 * @typedef {'simple' | 'standard' | 'complex'} Complexity
 */

/**
 * @typedef {'standard' | 'tdd'} TaskApproach
 * - standard: Implement first, then add tests (default)
 * - tdd: Test-Driven Development - write test first, then implement
 */

/**
 * @typedef {Object} TaskEvidence
 * @property {string} type
 * @property {string} description
 * @property {string} timestamp
 * @property {Record<string, unknown>} [data]
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} subject
 * @property {string} description
 * @property {Complexity} complexity
 * @property {TaskStatus} status
 * @property {string[]} blocked_by
 * @property {string[]} criteria
 * @property {TaskEvidence[]} evidence
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} [started_at]
 * @property {string} [resolved_at]
 * @property {TaskApproach} [approach] - 'tdd' requires test-first evidence
 * @property {string} [test_file] - Expected test file path (for TDD tasks)
 */

// ============================================================================
// Context Types
// ============================================================================

/**
 * @typedef {Object} Explorer
 * @property {string} id
 * @property {string} hint
 * @property {string} file
 * @property {string} summary
 */

/**
 * @typedef {Object} Context
 * @property {Explorer[]} explorers
 * @property {boolean} exploration_complete
 * @property {string[]} [key_files]
 * @property {string[]} [patterns]
 * @property {string[]} [expected_explorers]
 */

// ============================================================================
// Evidence Types
// ============================================================================

/**
 * @typedef {CommandEvidence | FileEvidence | AgentEvidence | TestEvidence} EvidenceEntry
 */

/**
 * @typedef {Object} CommandEvidence
 * @property {'command_execution'} type
 * @property {string} timestamp
 * @property {string} command
 * @property {number} exit_code
 * @property {string} output_preview
 */

/**
 * @typedef {Object} FileEvidence
 * @property {'file_operation'} type
 * @property {string} timestamp
 * @property {string} operation
 * @property {string} path
 */

/**
 * @typedef {Object} AgentEvidence
 * @property {'agent_completed'} type
 * @property {string} timestamp
 * @property {string} agent_id
 * @property {string} [task_id]
 */

/**
 * @typedef {Object} TestEvidence
 * @property {'test_result'} type
 * @property {string} timestamp
 * @property {boolean} passed
 * @property {string} framework
 * @property {string} output_preview
 */

// Export types (for JSDoc references in other files)
module.exports = {};
