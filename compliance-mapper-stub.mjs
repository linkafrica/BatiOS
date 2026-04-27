#!/usr/bin/env node
/**
 * Compliance Mapper stub (foundation version).
 *
 * Regex-based scan for common architectural violations. This is deliberately
 * conservative; a real Compliance Mapper agent with AST parsing, dataflow, and
 * database-aware RLS tests should replace it later.
 */

import { pathToFileURL } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const DEFAULT_REPO_ROOT = process.cwd();

export const RULES = [
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
    id: 'LLM_PROVIDER_HTTP_OUTSIDE_GATEWAY',
    description: 'Direct LLM provider HTTP call outside packages/agent-gateway',
    pattern:
      /https:\/\/api\.(openai|anthropic)\.com|https:\/\/generativelanguage\.googleapis\.com/i,
    allowedPath: /^packages\/agent-gateway\//,
    severity: 'REJECT',
    extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
  },
  {
    id: 'LLM_PROVIDER_SECRET_OUTSIDE_GATEWAY',
    description: 'Direct LLM provider secret access outside packages/agent-gateway',
    pattern: /process\.env\.(OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY)\b/,
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

const IGNORED_ENTRIES = new Set(['node_modules', 'dist', '.next', '.git', 'scratch', 'coverage']);

export function scanRepository(repoRoot = DEFAULT_REPO_ROOT) {
  const root = resolve(repoRoot);
  const violations = [];

  walk(root, root, (fullPath, relPath) => {
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
          addViolation(violations, {
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
        addViolation(violations, {
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

  return {
    clean: violations.length === 0,
    violations,
    hasBlock: violations.some((violation) => violation.severity === 'BLOCK'),
    hasReject: violations.some((violation) => violation.severity === 'REJECT'),
  };
}

function walk(root, dir, callback) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_ENTRIES.has(entry) || entry.startsWith('.')) {
      continue;
    }

    const full = join(dir, entry);
    const rel = relative(root, full).replaceAll('\\', '/');
    const stat = statSync(full);

    if (stat.isDirectory()) {
      walk(root, full, callback);
    } else {
      callback(full, rel);
    }
  }
}

function isMigrationPath(relPath) {
  return /(^|\/)migrations\//.test(relPath) || /^\d{4}[-_].*\.(ts|sql)$/.test(relPath);
}

function addViolation(violations, { rule, severity, description, file, line = 1, snippet = '' }) {
  violations.push({
    rule,
    severity,
    description,
    file,
    line,
    snippet: snippet.trim().slice(0, 120),
  });
}

export function formatScanResult(result) {
  if (result.clean) {
    return 'compliance-mapper: clean\n';
  }

  const lines = ['compliance-mapper: violations found', ''];
  for (const violation of result.violations) {
    lines.push(`[${violation.severity}] ${violation.rule}`);
    lines.push(`  ${violation.file}:${violation.line}`);
    lines.push(`  ${violation.description}`);
    lines.push(`  > ${violation.snippet}`);
    lines.push('');
  }

  if (result.hasBlock) {
    lines.push('BLOCK-class violation detected. No override path. Remediate before merging.');
  } else if (result.hasReject) {
    lines.push(
      'REJECT-class violation detected. Override via ADR-0005 two-signer protocol or remediate.',
    );
  }

  return `${lines.join('\n')}\n`;
}

function exitCodeFor(result) {
  if (result.hasBlock) return 2;
  if (result.hasReject) return 1;
  return 0;
}

const isCli = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

if (isCli) {
  const result = scanRepository(process.argv[2] ?? DEFAULT_REPO_ROOT);
  const output = formatScanResult(result);

  if (result.clean) {
    process.stdout.write(output);
  } else {
    process.stderr.write(output);
  }

  process.exit(exitCodeFor(result));
}
