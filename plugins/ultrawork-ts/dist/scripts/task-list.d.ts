#!/usr/bin/env node
/**
 * task-list.ts - List tasks with filtering
 * Usage: task-list.ts --session <ID> [--status open|resolved] [--format json|table]
 *
 * TypeScript port of task-list.sh
 */
interface TaskSummary {
    id: string;
    status: string;
    subject: string;
    blocked_by: string;
    complexity: string;
}
declare function collectTasks(tasksDir: string, statusFilter?: string): TaskSummary[];
declare function outputJson(tasks: TaskSummary[]): void;
declare function outputTable(tasks: TaskSummary[]): void;
export { collectTasks, outputJson, outputTable };
//# sourceMappingURL=task-list.d.ts.map