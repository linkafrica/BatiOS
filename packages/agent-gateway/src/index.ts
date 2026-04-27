export const agentGatewayBoundary = 'agent-gateway';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type AgentGatewayProvider = 'openai' | 'anthropic' | 'google' | 'local';

export type AgentGatewayMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentGatewayMessage {
  role: AgentGatewayMessageRole;
  content: string;
}

export interface AgentGatewayRequestMetadata {
  requestId: string;
  organisationId: string;
  projectId?: string;
  actorUserId: string;
  purpose:
    | 'field-evidence-assist'
    | 'contract-review'
    | 'payment-risk-review'
    | 'qa-compliance'
    | 'operator-support';
  custodyScope: 'tenant-only' | 'project-joint-custody' | 'public-reference';
  policyTags: readonly string[];
  retention: 'ephemeral' | 'audit-log' | 'case-record';
  requestedAt: Date;
  traceId?: string;
}

export interface AgentGatewayRequest {
  provider: AgentGatewayProvider;
  model: string;
  messages: readonly AgentGatewayMessage[];
  metadata: AgentGatewayRequestMetadata;
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface AgentGatewayUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentGatewayResponse {
  requestId: string;
  provider: AgentGatewayProvider;
  model: string;
  content: string;
  usage?: AgentGatewayUsage;
  providerResponseId?: string;
  completedAt: Date;
}

export interface AgentGatewayAuditEvent {
  requestId: string;
  organisationId: string;
  projectId?: string;
  actorUserId: string;
  provider: AgentGatewayProvider;
  model: string;
  purpose: AgentGatewayRequestMetadata['purpose'];
  custodyScope: AgentGatewayRequestMetadata['custodyScope'];
  policyTags: readonly string[];
  retention: AgentGatewayRequestMetadata['retention'];
  traceId?: string;
  requestedAt: Date;
  completedAt?: Date;
  outcome: 'accepted' | 'rejected' | 'completed' | 'failed';
  reason?: string;
  usage?: AgentGatewayUsage;
}

export interface AgentGatewayProviderClient {
  complete(request: AgentGatewayRequest): Promise<AgentGatewayResponse>;
}

export interface AgentGatewayAuditSink {
  record(event: AgentGatewayAuditEvent): Promise<void>;
}

export interface AgentGatewayPolicy {
  evaluate(request: AgentGatewayRequest): Promise<AgentGatewayPolicyDecision>;
}

export interface AgentGatewayPolicyDecision {
  allowed: boolean;
  reason?: string;
}

export interface AgentGateway {
  complete(request: AgentGatewayRequest): Promise<AgentGatewayResponse>;
}

export interface CreateAgentGatewayOptions {
  providers: Readonly<Record<AgentGatewayProvider, AgentGatewayProviderClient | undefined>>;
  auditSink: AgentGatewayAuditSink;
  policy?: AgentGatewayPolicy;
  now?: () => Date;
}

const allowAllPolicy: AgentGatewayPolicy = {
  async evaluate(): Promise<AgentGatewayPolicyDecision> {
    return { allowed: true };
  },
};

export function createAgentGateway(options: CreateAgentGatewayOptions): AgentGateway {
  const policy = options.policy ?? allowAllPolicy;
  const now = options.now ?? (() => new Date());

  return {
    async complete(request) {
      assertAuditableRequest(request);

      const provider = options.providers[request.provider];
      if (provider === undefined) {
        const reason = `provider ${request.provider} is not configured`;
        await options.auditSink.record(toAuditEvent(request, 'rejected', { reason }));
        throw new Error(reason);
      }

      const decision = await policy.evaluate(request);
      if (!decision.allowed) {
        const reason = decision.reason ?? 'request rejected by agent gateway policy';
        await options.auditSink.record(toAuditEvent(request, 'rejected', { reason }));
        throw new Error(reason);
      }

      await options.auditSink.record(toAuditEvent(request, 'accepted'));

      try {
        const response = await provider.complete(request);
        const completedAt = response.completedAt ?? now();
        const completedAudit: Pick<AgentGatewayAuditEvent, 'completedAt' | 'usage'> = {
          completedAt,
        };

        if (response.usage !== undefined) {
          completedAudit.usage = response.usage;
        }

        await options.auditSink.record(toAuditEvent(request, 'completed', completedAudit));

        return {
          ...response,
          requestId: request.metadata.requestId,
          provider: request.provider,
          model: request.model,
          completedAt,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'provider request failed';
        await options.auditSink.record(toAuditEvent(request, 'failed', { reason }));
        throw error;
      }
    },
  };
}

export function assertAuditableRequest(request: AgentGatewayRequest): void {
  assertPresent(request.metadata.requestId, 'metadata.requestId');
  assertPresent(request.metadata.organisationId, 'metadata.organisationId');
  assertPresent(request.metadata.actorUserId, 'metadata.actorUserId');
  assertPresent(request.metadata.purpose, 'metadata.purpose');
  assertPresent(request.metadata.custodyScope, 'metadata.custodyScope');
  assertPresent(request.metadata.retention, 'metadata.retention');
  assertPresent(request.provider, 'provider');
  assertPresent(request.model, 'model');

  if (request.messages.length === 0) {
    throw new Error('messages must contain at least one message');
  }

  if (request.metadata.policyTags.length === 0) {
    throw new Error('metadata.policyTags must contain at least one policy tag');
  }
}

function assertPresent(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function toAuditEvent(
  request: AgentGatewayRequest,
  outcome: AgentGatewayAuditEvent['outcome'],
  extras: Pick<AgentGatewayAuditEvent, 'completedAt' | 'reason' | 'usage'> = {},
): AgentGatewayAuditEvent {
  const event: AgentGatewayAuditEvent = {
    requestId: request.metadata.requestId,
    organisationId: request.metadata.organisationId,
    actorUserId: request.metadata.actorUserId,
    provider: request.provider,
    model: request.model,
    purpose: request.metadata.purpose,
    custodyScope: request.metadata.custodyScope,
    policyTags: request.metadata.policyTags,
    retention: request.metadata.retention,
    requestedAt: request.metadata.requestedAt,
    outcome,
  };

  if (request.metadata.projectId !== undefined) {
    event.projectId = request.metadata.projectId;
  }

  if (request.metadata.traceId !== undefined) {
    event.traceId = request.metadata.traceId;
  }

  if (extras.completedAt !== undefined) {
    event.completedAt = extras.completedAt;
  }

  if (extras.reason !== undefined) {
    event.reason = extras.reason;
  }

  if (extras.usage !== undefined) {
    event.usage = extras.usage;
  }

  return event;
}
