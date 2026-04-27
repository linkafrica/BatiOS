import { describe, expect, it } from 'vitest';

import {
  assertAuditableRequest,
  createAgentGateway,
  type AgentGatewayAuditEvent,
  type AgentGatewayProviderClient,
  type AgentGatewayRequest,
} from './index.js';

const requestedAt = new Date('2026-04-27T11:00:00.000Z');
const completedAt = new Date('2026-04-27T11:00:01.000Z');

function baseRequest(overrides: Partial<AgentGatewayRequest> = {}): AgentGatewayRequest {
  return {
    provider: 'local',
    model: 'batios-test-model',
    messages: [{ role: 'user', content: 'Summarise the site note.' }],
    metadata: {
      requestId: 'req_01',
      organisationId: '33333333-3333-4333-8333-333333333333',
      projectId: '22222222-2222-4222-8222-222222222222',
      actorUserId: '44444444-4444-4444-8444-444444444444',
      purpose: 'field-evidence-assist',
      custodyScope: 'project-joint-custody',
      policyTags: ['no-training', 'audit-required'],
      retention: 'audit-log',
      requestedAt,
      traceId: 'trace_01',
    },
    ...overrides,
  };
}

describe('agent gateway boundary', () => {
  it('requires audit metadata before provider calls can be made', () => {
    expect(() =>
      assertAuditableRequest(
        baseRequest({
          messages: [],
        }),
      ),
    ).toThrow('messages must contain at least one message');

    expect(() =>
      assertAuditableRequest(
        baseRequest({
          metadata: {
            ...baseRequest().metadata,
            policyTags: [],
          },
        }),
      ),
    ).toThrow('metadata.policyTags must contain at least one policy tag');
  });

  it('routes provider calls through policy and audit hooks', async () => {
    const events: AgentGatewayAuditEvent[] = [];
    const providerCalls: AgentGatewayRequest[] = [];
    const provider: AgentGatewayProviderClient = {
      async complete(request) {
        providerCalls.push(request);
        return {
          requestId: 'provider-generated-id',
          provider: 'local',
          model: 'provider-model',
          content: 'Evidence note summarised.',
          usage: { inputTokens: 12, outputTokens: 6 },
          completedAt,
        };
      },
    };

    const gateway = createAgentGateway({
      providers: { local: provider, openai: undefined, anthropic: undefined, google: undefined },
      auditSink: {
        async record(event) {
          events.push(event);
        },
      },
      policy: {
        async evaluate(request) {
          return { allowed: request.metadata.custodyScope === 'project-joint-custody' };
        },
      },
    });

    const response = await gateway.complete(baseRequest());

    expect(providerCalls).toHaveLength(1);
    expect(response).toMatchObject({
      requestId: 'req_01',
      provider: 'local',
      model: 'batios-test-model',
      content: 'Evidence note summarised.',
    });
    expect(events.map((event) => event.outcome)).toEqual(['accepted', 'completed']);
    expect(events[0]).toMatchObject({
      requestId: 'req_01',
      organisationId: '33333333-3333-4333-8333-333333333333',
      projectId: '22222222-2222-4222-8222-222222222222',
      actorUserId: '44444444-4444-4444-8444-444444444444',
      purpose: 'field-evidence-assist',
      custodyScope: 'project-joint-custody',
      retention: 'audit-log',
      traceId: 'trace_01',
    });
    expect(events[1]).toMatchObject({
      outcome: 'completed',
      completedAt,
      usage: { inputTokens: 12, outputTokens: 6 },
    });
  });

  it('audits rejected requests without calling the provider', async () => {
    const events: AgentGatewayAuditEvent[] = [];
    const providerCalls: AgentGatewayRequest[] = [];
    const gateway = createAgentGateway({
      providers: {
        local: {
          async complete(request) {
            providerCalls.push(request);
            throw new Error('should not call provider');
          },
        },
        openai: undefined,
        anthropic: undefined,
        google: undefined,
      },
      auditSink: {
        async record(event) {
          events.push(event);
        },
      },
      policy: {
        async evaluate() {
          return { allowed: false, reason: 'missing custody grant' };
        },
      },
    });

    await expect(gateway.complete(baseRequest())).rejects.toThrow('missing custody grant');

    expect(providerCalls).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      outcome: 'rejected',
      reason: 'missing custody grant',
    });
  });
});
