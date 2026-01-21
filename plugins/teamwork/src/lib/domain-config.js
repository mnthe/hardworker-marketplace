#!/usr/bin/env bun
/**
 * Domain Configuration for Teamwork
 * Defines domain structure with role and capability mappings
 */

// ============================================================================
// Domain Configuration
// ============================================================================

/**
 * Teamwork domain configuration
 * @typedef {Object} Domain
 * @property {string} name - Domain name
 * @property {string[]} roles - Worker roles associated with this domain
 * @property {string[]} capabilities - Capabilities this domain provides
 * @property {number} priority - Domain priority (1 = highest)
 */

/**
 * Domain definitions with role and capability mappings
 * Priority determines execution order (1 = highest priority)
 * @type {Domain[]}
 */
const TEAMWORK_DOMAINS = [
  {
    name: 'security',
    roles: ['security'],
    capabilities: ['auth', 'authorization', 'encryption', 'audit', 'vulnerability'],
    priority: 1,
  },
  {
    name: 'core',
    roles: ['backend', 'orchestrator'],
    capabilities: ['api', 'database', 'business-logic', 'coordination', 'planning'],
    priority: 2,
  },
  {
    name: 'integration',
    roles: ['frontend', 'devops'],
    capabilities: ['ui', 'components', 'ci-cd', 'deployment', 'infrastructure'],
    priority: 3,
  },
  {
    name: 'quality',
    roles: ['test', 'review'],
    capabilities: ['testing', 'review', 'refactoring', 'code-quality'],
    priority: 4,
  },
  {
    name: 'performance',
    roles: ['review'],
    capabilities: ['optimization', 'benchmarking', 'profiling'],
    priority: 5,
  },
  {
    name: 'deployment',
    roles: ['devops', 'docs'],
    capabilities: ['release', 'documentation', 'deployment', 'monitoring'],
    priority: 6,
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get domain name for a given role
 * @param {string} role - Worker role
 * @returns {string | null} Domain name or null if not found
 */
function getDomainForRole(role) {
  const domain = TEAMWORK_DOMAINS.find((d) => d.roles.includes(role));
  return domain ? domain.name : null;
}

/**
 * Get domain name for a given capability
 * @param {string} capability - Capability keyword
 * @returns {string | null} Domain name or null if not found
 */
function getDomainForCapability(capability) {
  const domain = TEAMWORK_DOMAINS.find((d) => d.capabilities.includes(capability));
  return domain ? domain.name : null;
}

/**
 * Validate if a domain name is valid
 * @param {string} domain - Domain name to validate
 * @returns {boolean} True if domain exists
 */
function isValidDomain(domain) {
  return TEAMWORK_DOMAINS.some((d) => d.name === domain);
}

/**
 * Get full domain configuration object
 * @param {string} domain - Domain name
 * @returns {Domain | null} Domain object or null if not found
 */
function getDomainConfig(domain) {
  const domainConfig = TEAMWORK_DOMAINS.find((d) => d.name === domain);
  return domainConfig || null;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  TEAMWORK_DOMAINS,
  getDomainForRole,
  getDomainForCapability,
  isValidDomain,
  getDomainConfig,
};
