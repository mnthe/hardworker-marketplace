#!/usr/bin/env bun

/**
 * Subagent Start Tracking Hook
 * Records when ultrawork sub-agents are spawned
 * Tracks active agents in session.active_agents[]
 */

const fs = require('fs');
const {
  getSessionFile,
  updateSession,
} = require('../lib/session-utils.js');
const {
  readStdin,
  runHook
} = require('../lib/hook-utils.js');

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id]
 * @property {string} [agent_id]
 * @property {string} [agent_type]
 */

/**
 * @typedef {Object} ActiveAgent
 * @property {string} agent_id
 * @property {string} agent_type
 * @property {string} started_at
 */

function outputResponse() {
  return {};
}

async function main() {
  const input = await readStdin();
  /** @type {HookInput} */
  const hookInput = JSON.parse(input);

  const sessionId = hookInput.session_id;
  const agentId = hookInput.agent_id || '';
  const agentType = hookInput.agent_type || '';

  // No session - not ultrawork
  if (!sessionId) {
    console.log(JSON.stringify(outputResponse()));
    process.exit(0);
    return;
  }

  // Check session exists
  const sessionFile = getSessionFile(sessionId);
  if (!fs.existsSync(sessionFile)) {
    console.log(JSON.stringify(outputResponse()));
    process.exit(0);
    return;
  }

  // Record active agent
  try {
    await updateSession(sessionId, (s) => {
      const activeAgents = s.active_agents || [];

      // Avoid duplicates
      if (activeAgents.some((a) => a.agent_id === agentId)) {
        return s;
      }

      /** @type {ActiveAgent} */
      const agent = {
        agent_id: agentId,
        agent_type: agentType,
        started_at: new Date().toISOString(),
      };

      return {
        ...s,
        active_agents: [...activeAgents, agent],
      };
    });

    console.error(`Agent started: ${agentType} (${agentId})`);
  } catch (err) {
    console.error(`Failed to track agent start: ${err}`);
  }

  console.log(JSON.stringify(outputResponse()));
  process.exit(0);
}

runHook(main, outputResponse);
