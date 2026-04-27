#!/usr/bin/env node
/**
 * Compliance Mapper stub (Week 0 version).
 *
 * Regex-based scan for common architectural violations. This is deliberately
 * crude; a real Compliance Mapper agent with AST parsing and database-aware RLS
 * tests must replace it later.
 *
 * What this stub catches:
 *   - Direct LLM SDK imports or require() calls outside packages/agent-gateway
 *   - Direct INSERT/UPDATE/DELETE on artifact_events outside packages/events-core
 *   - localStorage or sessionStorage use
 *   - Migration files that create tenant-like tables but do not enable RLS and
 *     define at least one CREATE POLICY block
 *
 * What this stub does NOT catch:
 *   - Semantic RLS errors, policy recursion, or wrong policy predicates
 *   - Dynamic imports, obfuscated imports, generated code, or comments/strings
 *   - Cross-tenant retrieval leakage in agent calls
 *   - Methodology-reference validation gaps
 *   - Cascade atomicity violations
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const REPO_ROOT = process.cwd();
const violations = [];

const RULES = [
  {
    id: 'LLM_SDK_OUTSIDE_GATEWAY',
    description: 'Direct LLM SDK import outside packages/agent-gateway',
    pattern:
      /(?:from\s+['"]|import\(['"]|require\(['"])(@anthropic-ai\/sdk|openai|@google\/generative-ai)['"]\)?/,
    allowedPath: /^packages\/agent-gateway\//,
    severity: 'REJECT',
    extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
  },
  {
    id: 'DIRECT_ARTIFACT_EVENTS_WRITE',
    description: 'Direct write to artifact_events outside packages/events-core',
    pattern:
      /(insertInto\(['"]artifact_events['"]\)|INSERT\s+INTO\s+artifact_events|UPDATE\s+artifact_events|DELETE\s+FROM\s+artifact_events)/i,
    allowedPath: /^packages\/events-core\//,
    severity: 'BLOCK',
    extensions: ['.ts', '.tsx', '.sql'],
  },
  {
    id: 'BROWSER_STORAGE_USE',
    description: 'localStorage or sessionStorage use is not supported in this runtime',
    pattern: /\b(localStorage|sessionStorage)\.(get|set|remove)Item\b/,
    allowedPath: null,
    severity: 'REJECT',
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
];

function walk(dir, callback) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(REPO_ROOT, full).replaceAll('\\', '/');
    if (
      entry === 'node_modules' ||
      entry === 'dist' ||
      entry === '.next' ||
      entry === '.git' ||
      entry === 'scratch' ||
      entry.startsWith('.')
    ) {
      continue;
    }

    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, callback);
    } else {
      callback(full, rel);
    }
  }
}

function isMigrationPath(relPath) {
  return /(^|\/)migrations\//.test(relPath) || /^\d{4}[-_].*\.(ts|sql)$/.test(relPath);
}

function addViolation({ rule, severity, description, file, line = 1, snippet = '' }) {
  violations.push({ rule, severity, description, file, line, snippet: snippet.trim().slice(0, 120) });
}

walk(REPO_ROOT, (fullPath, relPath) => {
  const extension = extname(relPath);
  let content;
  try {
    content = readFileSync(fullPath, 'utf8');
  } catch {
    return;
  }

  for (const rule of RULES) {
    if (!rule.extensions.includes(extension)) continue;
    if (rule.allowedPath && rule.allowedPath.test(relPath)) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        addViolation({
          rule: rule.id,
          severity: rule.severity,
          description: rule.description,
          file: relPath,
          line: i + 1,
          snippet: lines[i],
        });
      }
    }
  }

  if (isMigrationPath(relPath) && /createTable\(|CREATE\s+TABLE/i.test(content)) {
    const appearsTenantScoped = /organisation_id|tenant_hash|project_id/i.test(content);
    const enablesRls = /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(content);
    const forcesRls = /FORCE\s+ROW\s+LEVEL\s+SECURITY/i.test(content);
    const hasPolicy = /CREATE\s+POLICY/i.test(content);

    if (appearsTenantScoped && (!enablesRls || !forcesRls || !hasPolicy)) {
      addViolation({
        rule: 'TENANT_MIGRATION_WITHOUT_RLS_BLOCK',
        severity: 'BLOCK',
        description:
          'Migration appears tenant-scoped but does not include ENABLE RLS, FORCE RLS, and at least one CREATE POLICY block',
        file: relPath,
        snippet: 'tenant-like migration missing complete RLS block',
      });
    }
  }
});

if (violations.length === 0) {
  console.log('compliance-mapper: clean');
  process.exit(0);
}

console.error('compliance-mapper: violations found');
console.error('');
for (const v of violations) {
  console.error(`[${v.severity}] ${v.rule}`);
  console.error(`  ${v.file}:${v.line}`);
  console.error(`  ${v.description}`);
  console.error(`  > ${v.snippet}`);
  console.error('');
}

const hasBlock = violations.some((v) => v.severity === 'BLOCK');
const hasReject = violations.some((v) => v.severity === 'REJECT');

if (hasBlock) {
  console.error('BLOCK-class violation detected. No override path. Remediate before merging.');
  process.exit(2);
}
if (hasReject) {
  console.error('REJECT-class violation detected. Override via ADR-0005 two-signer protocol or remediate.');
  process.exit(1);
}
process.exit(0);
