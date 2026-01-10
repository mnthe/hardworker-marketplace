/**
 * Type definitions for ultrawork-ts
 * Session state management and task tracking interfaces
 */
export type Phase = 'PLANNING' | 'EXECUTION' | 'VERIFICATION' | 'COMPLETE' | 'CANCELLED' | 'FAILED' | 'unknown';
export type ExplorationStage = 'not_started' | 'overview' | 'analyzing' | 'targeted' | 'complete';
export interface SessionOptions {
    max_workers: number;
    max_iterations: number;
    skip_verify: boolean;
    plan_only: boolean;
    auto_mode: boolean;
}
export interface Session {
    version: string;
    session_id: string;
    working_dir: string;
    goal: string;
    started_at: string;
    updated_at: string;
    phase: Phase;
    exploration_stage: ExplorationStage;
    iteration: number;
    plan: {
        approved_at: string | null;
    };
    options: SessionOptions;
    evidence_log: EvidenceEntry[];
    cancelled_at: string | null;
}
export type TaskStatus = 'pending' | 'in_progress' | 'resolved' | 'blocked' | 'open';
export type Complexity = 'simple' | 'standard' | 'complex';
export interface TaskEvidence {
    type: string;
    description: string;
    timestamp: string;
    data?: Record<string, unknown>;
}
export interface Task {
    id: string;
    subject: string;
    description: string;
    complexity: Complexity;
    status: TaskStatus;
    blocked_by: string[];
    criteria: string[];
    evidence: TaskEvidence[];
    created_at: string;
    updated_at: string;
    started_at?: string;
    resolved_at?: string;
}
export interface Explorer {
    id: string;
    hint: string;
    file: string;
    summary: string;
}
export interface Context {
    explorers: Explorer[];
    exploration_complete: boolean;
    key_files?: string[];
    patterns?: string[];
    expected_explorers?: string[];
}
export type EvidenceEntry = CommandEvidence | FileEvidence | AgentEvidence | TestEvidence;
export interface CommandEvidence {
    type: 'command_execution';
    timestamp: string;
    command: string;
    exit_code: number;
    output_preview: string;
}
export interface FileEvidence {
    type: 'file_operation';
    timestamp: string;
    operation: string;
    path: string;
}
export interface AgentEvidence {
    type: 'agent_completed';
    timestamp: string;
    agent_id: string;
    task_id?: string;
}
export interface TestEvidence {
    type: 'test_result';
    timestamp: string;
    passed: boolean;
    framework: string;
    output_preview: string;
}
//# sourceMappingURL=types.d.ts.map