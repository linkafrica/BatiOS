import { describe, expect, it } from 'vitest';

import type { AgentGateway, AgentGatewayRequest } from '@batios/agent-gateway';

import { assessIpcWorkItem, createIpcAutopilot, type IpcAssessmentWorkItem } from './index.js';

const requestedAt = new Date('2026-04-27T12:00:00.000Z');
const completedAt = new Date('2026-04-27T12:00:02.000Z');

function baseWorkItem(overrides: Partial<IpcAssessmentWorkItem> = {}): IpcAssessmentWorkItem {
  return {
    workItemId: 'ipc-work-001',
    organisationId: '33333333-3333-4333-8333-333333333333',
    projectId: '22222222-2222-4222-8222-222222222222',
    contractReference: 'BAT-ROAD-2026-001',
    paymentCertificateReference: 'IPC-004',
    contractItem: 'Drainage culvert concrete works',
    claimedAmount: 125000,
    currency: 'GHS',
    evidenceArtifactIds: ['artifact-measurement-sheet', 'artifact-site-photo'],
    submittedByUserId: '55555555-5555-4555-8555-555555555555',
    submittedAt: new Date('2026-04-27T09:30:00.000Z'),
    ...overrides,
  };
}

describe('ipc autopilot orchestration', () => {
  it('routes IPC assessments through the agent gateway with audit metadata', async () => {
    const gatewayRequests: AgentGatewayRequest[] = [];
    const gateway: AgentGateway = {
      async complete(request) {
        gatewayRequests.push(request);
        return {
          requestId: request.metadata.requestId,
          provider: request.provider,
          model: request.model,
          content: JSON.stringify({
            recommendation: 'needs-review',
            riskLevel: 'medium',
            summary: 'Evidence supports the claim, but measurements need QS confirmation.',
            requiredActions: ['Confirm measured quantities before certification'],
          }),
          completedAt,
        };
      },
    };

    const autopilot = createIpcAutopilot({
      agentGateway: gateway,
      provider: 'local',
      model: 'batios-ipc-risk-v1',
    });

    const result = await autopilot.assess({
      requestId: 'req-ipc-001',
      actorUserId: '44444444-4444-4444-8444-444444444444',
      requestedAt,
      traceId: 'trace-ipc-001',
      workItem: baseWorkItem(),
    });

    expect(gatewayRequests).toHaveLength(1);
    expect(gatewayRequests[0]).toMatchObject({
      provider: 'local',
      model: 'batios-ipc-risk-v1',
      temperature: 0.1,
      responseFormat: 'json',
      metadata: {
        requestId: 'req-ipc-001',
        organisationId: '33333333-3333-4333-8333-333333333333',
        projectId: '22222222-2222-4222-8222-222222222222',
        actorUserId: '44444444-4444-4444-8444-444444444444',
        purpose: 'payment-risk-review',
        custodyScope: 'project-joint-custody',
        policyTags: ['ipc-autopilot', 'payment-certificate', 'no-training'],
        retention: 'audit-log',
        requestedAt,
        traceId: 'trace-ipc-001',
      },
    });
    expect(gatewayRequests[0]?.messages).toHaveLength(2);
    expect(gatewayRequests[0]?.messages[1]?.content).toContain('artifact-measurement-sheet');
    expect(result).toEqual({
      assessmentId: 'ipc:ipc-work-001:req-ipc-001',
      gatewayRequestId: 'req-ipc-001',
      workItemId: 'ipc-work-001',
      organisationId: '33333333-3333-4333-8333-333333333333',
      projectId: '22222222-2222-4222-8222-222222222222',
      recommendation: 'needs-review',
      riskLevel: 'medium',
      summary: 'Evidence supports the claim, but measurements need QS confirmation.',
      requiredActions: ['Confirm measured quantities before certification'],
      sourceArtifactIds: ['artifact-measurement-sheet', 'artifact-site-photo'],
      assessedAt: completedAt,
    });
  });

  it('rejects work items without evidence artifacts before calling the gateway', async () => {
    const gatewayRequests: AgentGatewayRequest[] = [];
    const gateway: AgentGateway = {
      async complete(request) {
        gatewayRequests.push(request);
        throw new Error('gateway should not be called');
      },
    };

    await expect(
      assessIpcWorkItem(
        {
          agentGateway: gateway,
          provider: 'local',
          model: 'batios-ipc-risk-v1',
        },
        {
          requestId: 'req-ipc-002',
          actorUserId: '44444444-4444-4444-8444-444444444444',
          workItem: baseWorkItem({ evidenceArtifactIds: [] }),
        },
      ),
    ).rejects.toThrow('workItem.evidenceArtifactIds must contain at least one artifact');

    expect(gatewayRequests).toHaveLength(0);
  });

  it('fails closed when the gateway returns an invalid assessment payload', async () => {
    const gateway: AgentGateway = {
      async complete(request) {
        return {
          requestId: request.metadata.requestId,
          provider: request.provider,
          model: request.model,
          content: JSON.stringify({ recommendation: 'approve', summary: '' }),
          completedAt,
        };
      },
    };

    await expect(
      assessIpcWorkItem(
        {
          agentGateway: gateway,
          provider: 'local',
          model: 'batios-ipc-risk-v1',
        },
        {
          requestId: 'req-ipc-003',
          actorUserId: '44444444-4444-4444-8444-444444444444',
          requestedAt,
          workItem: baseWorkItem(),
        },
      ),
    ).rejects.toThrow('IPC_AUTOPILOT_INVALID_GATEWAY_RESPONSE');
  });
});
