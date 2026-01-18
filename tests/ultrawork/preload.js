#!/usr/bin/env bun
/**
 * Test Preload Script for Ultrawork Tests
 *
 * This script runs BEFORE any test file is loaded.
 * It sets up the test environment to ensure isolation from real user data.
 *
 * Usage: bun test --preload ./tests/ultrawork/preload.js tests/ultrawork/
 *
 * CRITICAL: This ensures that even if a test file forgets to set
 * ULTRAWORK_TEST_BASE_DIR, it will still be isolated.
 */

const path = require('path');
const os = require('os');

// Set test base directory for all tests
const TEST_BASE_DIR = path.join(os.tmpdir(), 'ultrawork-test');
process.env.ULTRAWORK_TEST_BASE_DIR = TEST_BASE_DIR;

// Log for visibility during test runs
console.log(`\n🔒 Test Isolation Active`);
console.log(`   Test base: ${TEST_BASE_DIR}`);
console.log(`   Real path protected: ${path.join(os.homedir(), '.claude', 'ultrawork')}\n`);
