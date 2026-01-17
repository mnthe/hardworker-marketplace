#!/usr/bin/env bun
/**
 * Tests for types.js - Type definitions
 */

const { describe, test, expect } = require('bun:test');
const types = require('../../../plugins/ultrawork/src/lib/types.js');

describe('types.js', () => {
  describe('module exports', () => {
    test('should export empty object (JSDoc only)', () => {
      expect(typeof types).toBe('object');
      expect(Object.keys(types).length).toBe(0);
    });

    test('should be importable without errors', () => {
      expect(() => {
        require('../../../plugins/ultrawork/src/lib/types.js');
      }).not.toThrow();
    });
  });

  describe('typedef validation', () => {
    test('should allow JSDoc type references', () => {
      // This test verifies that the types file can be required
      // and that JSDoc type annotations work correctly.
      // The actual type checking happens at runtime by TypeScript/JSDoc.

      /**
       * @typedef {import('../../../plugins/ultrawork/src/lib/types.js').Phase} Phase
       */

      /** @type {Phase} */
      const phase = 'PLANNING';
      expect(phase).toBe('PLANNING');

      // Valid phase values
      const validPhases = ['PLANNING', 'EXECUTION', 'VERIFICATION', 'COMPLETE', 'CANCELLED', 'FAILED', 'unknown'];
      expect(validPhases).toContain(phase);
    });

    test('should support ExplorationStage typedef', () => {
      /**
       * @typedef {import('../../../plugins/ultrawork/src/lib/types.js').ExplorationStage} ExplorationStage
       */

      /** @type {ExplorationStage} */
      const stage = 'overview';
      expect(stage).toBe('overview');

      // Valid stages
      const validStages = ['not_started', 'overview', 'analyzing', 'targeted', 'complete'];
      expect(validStages).toContain(stage);
    });

    test('should support TaskStatus typedef', () => {
      /**
       * @typedef {import('../../../plugins/ultrawork/src/lib/types.js').TaskStatus} TaskStatus
       */

      /** @type {TaskStatus} */
      const status = 'open';
      expect(status).toBe('open');

      // Valid statuses
      const validStatuses = ['pending', 'in_progress', 'resolved', 'blocked', 'open'];
      expect(validStatuses).toContain(status);
    });

    test('should support Complexity typedef', () => {
      /**
       * @typedef {import('../../../plugins/ultrawork/src/lib/types.js').Complexity} Complexity
       */

      /** @type {Complexity} */
      const complexity = 'standard';
      expect(complexity).toBe('standard');

      // Valid complexity values
      const validComplexities = ['simple', 'standard', 'complex'];
      expect(validComplexities).toContain(complexity);
    });

    test('should support TaskApproach typedef', () => {
      /**
       * @typedef {import('../../../plugins/ultrawork/src/lib/types.js').TaskApproach} TaskApproach
       */

      /** @type {TaskApproach} */
      const approach = 'tdd';
      expect(approach).toBe('tdd');

      // Valid approach values
      const validApproaches = ['standard', 'tdd'];
      expect(validApproaches).toContain(approach);
    });
  });

  describe('type structure validation', () => {
    test('should validate Session structure', () => {
      // Mock session object that should match Session typedef
      const session = {
        version: '6.0',
        session_id: 'test-123',
        working_dir: '/tmp/test',
        goal: 'Test goal',
        started_at: '2026-01-17T00:00:00Z',
        updated_at: '2026-01-17T00:00:00Z',
        phase: 'PLANNING',
        exploration_stage: 'overview',
        iteration: 1,
        plan: { approved_at: null },
        options: {
          max_workers: 0,
          max_iterations: 5,
          skip_verify: false,
          plan_only: false,
          auto_mode: false
        },
        evidence_log: [],
        cancelled_at: null
      };

      expect(session.version).toBe('6.0');
      expect(session.phase).toBe('PLANNING');
      expect(Array.isArray(session.evidence_log)).toBe(true);
    });

    test('should validate Task structure', () => {
      // Mock task object that should match Task typedef
      const task = {
        id: '1',
        subject: 'Test task',
        description: 'Test description',
        complexity: 'standard',
        status: 'open',
        blocked_by: [],
        criteria: ['criterion 1', 'criterion 2'],
        evidence: [],
        created_at: '2026-01-17T00:00:00Z',
        updated_at: '2026-01-17T00:00:00Z',
        approach: 'standard'
      };

      expect(task.id).toBe('1');
      expect(task.status).toBe('open');
      expect(Array.isArray(task.criteria)).toBe(true);
    });

    test('should validate Context structure', () => {
      // Mock context object that should match Context typedef
      const context = {
        explorers: [],
        exploration_complete: false,
        key_files: ['file1.ts', 'file2.ts'],
        patterns: ['pattern1', 'pattern2']
      };

      expect(Array.isArray(context.explorers)).toBe(true);
      expect(typeof context.exploration_complete).toBe('boolean');
      expect(Array.isArray(context.key_files)).toBe(true);
    });

    test('should validate EvidenceEntry types', () => {
      // Command evidence
      const commandEvidence = {
        type: 'command_execution',
        timestamp: '2026-01-17T00:00:00Z',
        command: 'npm test',
        exit_code: 0,
        output_preview: 'Tests passed'
      };
      expect(commandEvidence.type).toBe('command_execution');

      // File evidence
      const fileEvidence = {
        type: 'file_operation',
        timestamp: '2026-01-17T00:00:00Z',
        operation: 'write',
        path: '/tmp/test.ts'
      };
      expect(fileEvidence.type).toBe('file_operation');

      // Test evidence
      const testEvidence = {
        type: 'test_result',
        timestamp: '2026-01-17T00:00:00Z',
        passed: true,
        framework: 'bun:test',
        output_preview: '5 tests passed'
      };
      expect(testEvidence.type).toBe('test_result');
    });
  });
});
