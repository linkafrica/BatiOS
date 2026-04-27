import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { PRE_PR_CHECKS, runQaHarness } from './index.js';

const complianceMapperPath = resolve(process.cwd(), '../../compliance-mapper-stub.mjs');
const llmImportSource = `import OpenAI from '${'open' + 'ai'}';`;
const llmSecretSource = `export const key = process.env.${'OPENAI' + '_API_KEY'};`;
const artifactWriteSource = `return db.insertInto('${'artifact' + '_events'}').values({});`;

function withFixture(files: Record<string, string>, callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'batios-compliance-'));

  try {
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(root, path);
      mkdirSync(resolve(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, content);
    }

    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runCompliance(root: string): { status: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [complianceMapperPath, root], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status: number; stderr: Buffer; stdout: Buffer };
    return {
      status: failure.status,
      output: `${failure.stdout.toString()}${failure.stderr.toString()}`,
    };
  }
}

describe('qa harness', () => {
  it('declares the required pre-PR checks', () => {
    expect(PRE_PR_CHECKS.map((check) => check.id)).toEqual([
      'build',
      'lint',
      'typecheck',
      'test',
      'format',
      'compliance',
    ]);
  });

  it('validates the current repo QA script and CI compliance wiring', () => {
    const result = runQaHarness(resolve(process.cwd(), '../..'));

    expect(result.ok).toBe(true);
    expect(result.missingScripts).toEqual([]);
    expect(result.ciRunsComplianceScan).toBe(true);
  });

  it('blocks direct LLM SDK and provider secret usage outside the agent gateway', () => {
    withFixture(
      {
        'apps/admin/app/page.tsx': `
          ${llmImportSource}
          ${llmSecretSource}
        `,
      },
      (root) => {
        const result = runCompliance(root);

        expect(result.status).toBe(1);
        expect(result.output).toContain('LLM_SDK_OUTSIDE_GATEWAY');
        expect(result.output).toContain('LLM_PROVIDER_SECRET_OUTSIDE_GATEWAY');
      },
    );
  });

  it('blocks direct artifact event writes outside events-core', () => {
    withFixture(
      {
        'packages/api-client/src/index.ts': `
          export function write(db) {
            ${artifactWriteSource}
          }
        `,
      },
      (root) => {
        const result = runCompliance(root);

        expect(result.status).toBe(2);
        expect(result.output).toContain('DIRECT_ARTIFACT_EVENTS_WRITE');
      },
    );
  });

  it('blocks tenant-scoped migrations without a complete RLS block', () => {
    withFixture(
      {
        'packages/platform-core/src/migrations/0002-projects.ts': `
          export async function up(db) {
            await db.schema.createTable('unsafe_projects')
              .addColumn('project_id', 'uuid')
              .addColumn('organisation_id', 'uuid')
              .execute();
          }
        `,
      },
      (root) => {
        const result = runCompliance(root);

        expect(result.status).toBe(2);
        expect(result.output).toContain('TENANT_MIGRATION_WITHOUT_RLS_BLOCK');
      },
    );
  });

  it('allows owned gateway and events-core boundary operations', () => {
    withFixture(
      {
        'packages/agent-gateway/src/provider.ts': `
          ${llmImportSource}
          ${llmSecretSource}
        `,
        'packages/events-core/src/artifact-events.ts': `
          export function append(db) {
            ${artifactWriteSource}
          }
        `,
      },
      (root) => {
        const result = runCompliance(root);

        expect(result.status).toBe(0);
        expect(result.output).toContain('compliance-mapper: clean');
      },
    );
  });
});
