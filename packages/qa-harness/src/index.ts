#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface QaHarnessCheck {
  id: string;
  command: string;
  required: boolean;
}

export interface QaHarnessResult {
  ok: boolean;
  repoRoot: string;
  checks: readonly QaHarnessCheck[];
  missingScripts: readonly string[];
  ciRunsComplianceScan: boolean;
}

export const PRE_PR_CHECKS: readonly QaHarnessCheck[] = [
  { id: 'build', command: 'corepack pnpm build', required: true },
  { id: 'e2e', command: 'corepack pnpm e2e:workflow', required: true },
  { id: 'lint', command: 'corepack pnpm lint', required: true },
  { id: 'typecheck', command: 'corepack pnpm typecheck', required: true },
  { id: 'test', command: 'corepack pnpm test', required: true },
  { id: 'format', command: 'corepack pnpm format:check', required: true },
  { id: 'compliance', command: 'corepack pnpm compliance:scan', required: true },
];

const scriptNamesByCheckId: Readonly<Record<string, string>> = {
  build: 'build',
  e2e: 'e2e:workflow',
  lint: 'lint',
  typecheck: 'typecheck',
  test: 'test',
  format: 'format:check',
  compliance: 'compliance:scan',
};

export function runQaHarness(
  repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'),
): QaHarnessResult {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  const missingScripts = PRE_PR_CHECKS.map((check) => check.id).filter((id) => {
    const scriptName = scriptNamesByCheckId[id] ?? id;
    return scripts[scriptName] === undefined;
  });

  const ciWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const ciRunsComplianceScan = /compliance(:scan|-mapper-stub\.mjs)/.test(ciWorkflow);

  return {
    ok: missingScripts.length === 0 && ciRunsComplianceScan,
    repoRoot,
    checks: PRE_PR_CHECKS,
    missingScripts,
    ciRunsComplianceScan,
  };
}

export function formatQaHarnessResult(result: QaHarnessResult): string {
  const lines = ['BatiOS QA harness', '', 'Required pre-PR checks:'];

  for (const check of result.checks) {
    lines.push(`- ${check.command}`);
  }

  lines.push('');
  lines.push(`CI compliance scan: ${result.ciRunsComplianceScan ? 'configured' : 'missing'}`);

  if (result.missingScripts.length > 0) {
    lines.push(`Missing package scripts: ${result.missingScripts.join(', ')}`);
  }

  lines.push(`Status: ${result.ok ? 'ready' : 'blocked'}`);
  return `${lines.join('\n')}\n`;
}

function main(): void {
  const result = runQaHarness();
  process.stdout.write(formatQaHarnessResult(result));
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
