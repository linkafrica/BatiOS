import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const diagnostics = [];

function pass(message) {
  diagnostics.push(`PASS ${message}`);
}

function fail(message) {
  diagnostics.push(`FAIL ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
    return false;
  }

  pass(message);
  return true;
}

function assertFileContains(relativePath, signals, label) {
  const content = readFileSync(resolve(repoRoot, relativePath), 'utf8');

  for (const signal of signals) {
    assert(content.includes(signal), `${label} exposes "${signal}"`);
  }
}

assertFileContains(
  'apps/field-pwa/app/page.tsx',
  ['Field evidence capture', 'New evidence record', 'Submit evidence', 'Review queue'],
  'field evidence capture',
);
assertFileContains(
  'apps/pm-dashboard/app/page.tsx',
  ['Evidence awaiting PM action', 'Evidence review lane', 'Payment readiness'],
  'PM dashboard review',
);
assertFileContains(
  'apps/qs-dashboard/app/page.tsx',
  ['Quantity verification desk', 'Evidence match', 'Certificate prep'],
  'QS dashboard review',
);
assertFileContains(
  'apps/admin/app/page.tsx',
  ['Access governance', 'Compliance monitor', 'failed evidence sync report'],
  'admin audit visibility',
);

const agentGatewayModule = await import(
  pathToFileURL(resolve(repoRoot, 'packages/agent-gateway/dist/index.js')).href
);
const ipcAutopilotModule = await import(
  pathToFileURL(resolve(repoRoot, 'packages/ipc-autopilot/dist/index.js')).href
);

const auditEvents = [];
const providerCalls = [];
const completedAt = new Date('2026-04-28T10:00:01.000Z');

const gateway = agentGatewayModule.createAgentGateway({
  providers: {
    local: {
      async complete(request) {
        providerCalls.push(request);
        return {
          requestId: request.metadata.requestId,
          provider: request.provider,
          model: request.model,
          content: JSON.stringify({
            recommendation: 'needs-review',
            riskLevel: 'medium',
            summary: 'Evidence packet is complete, but QS must confirm measured quantity.',
            requiredActions: ['Confirm measured quantity before certification'],
          }),
          usage: { inputTokens: 42, outputTokens: 16 },
          completedAt,
        };
      },
    },
    openai: undefined,
    anthropic: undefined,
    google: undefined,
  },
  auditSink: {
    async record(event) {
      auditEvents.push(event);
    },
  },
});

const autopilot = ipcAutopilotModule.createIpcAutopilot({
  agentGateway: gateway,
  provider: 'local',
  model: 'batios-e2e-local',
});

const assessment = await autopilot.assess({
  requestId: 'req-e2e-ipc-001',
  actorUserId: '44444444-4444-4444-8444-444444444444',
  requestedAt: new Date('2026-04-28T10:00:00.000Z'),
  traceId: 'trace-e2e-workflow-001',
  workItem: {
    workItemId: 'ipc-work-e2e-001',
    organisationId: '33333333-3333-4333-8333-333333333333',
    projectId: '22222222-2222-4222-8222-222222222222',
    contractReference: 'GH-PW-2026-014',
    paymentCertificateReference: 'IPC-E2E-001',
    contractItem: 'Culvert reinforcement',
    claimedAmount: 125000,
    currency: 'GHS',
    evidenceArtifactIds: ['artifact-e2e-photo', 'artifact-e2e-measurement'],
    submittedByUserId: '55555555-5555-4555-8555-555555555555',
    submittedAt: new Date('2026-04-28T09:30:00.000Z'),
  },
});

assert(providerCalls.length === 1, 'IPC assessment request routes through one Agent Gateway call');
assert(assessment.recommendation === 'needs-review', 'IPC Autopilot returns assessment outcome');
assert(assessment.sourceArtifactIds.length === 2, 'IPC assessment preserves source artifacts');
assert(
  providerCalls[0]?.metadata.purpose === 'payment-risk-review',
  'Agent Gateway request is tagged for payment risk review',
);
assert(
  providerCalls[0]?.metadata.custodyScope === 'project-joint-custody',
  'Agent Gateway request carries project joint custody scope',
);

const acceptedAudit = auditEvents.find((event) => event.outcome === 'accepted');
const completedAudit = auditEvents.find((event) => event.outcome === 'completed');

assert(acceptedAudit !== undefined, 'audit stream exposes accepted gateway event');
assert(completedAudit !== undefined, 'audit stream exposes completed gateway event');
assert(
  completedAudit?.usage?.inputTokens === 42 && completedAudit?.usage?.outputTokens === 16,
  'completed audit event includes token usage diagnostics',
);
assert(
  completedAudit?.traceId === 'trace-e2e-workflow-001',
  'completed audit event preserves workflow trace id',
);

for (const line of diagnostics) {
  console.log(line);
}

if (diagnostics.some((line) => line.startsWith('FAIL '))) {
  process.exit(1);
}

console.log('E2E workflow check passed.');
