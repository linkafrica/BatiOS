import type {
  AgentGateway,
  AgentGatewayProvider,
  AgentGatewayRequest,
  AgentGatewayResponse,
} from '@batios/agent-gateway';

export const ipcAutopilotBoundary = 'ipc-autopilot';

export type IpcAssessmentRecommendation = 'approve' | 'needs-review' | 'reject';

export type IpcAssessmentRiskLevel = 'low' | 'medium' | 'high';

export interface IpcAssessmentWorkItem {
  workItemId: string;
  organisationId: string;
  projectId: string;
  contractReference: string;
  paymentCertificateReference: string;
  contractItem: string;
  claimedAmount: number;
  currency: string;
  evidenceArtifactIds: readonly string[];
  submittedByUserId: string;
  submittedAt: Date;
}

export interface IpcAutopilotInput {
  requestId: string;
  actorUserId: string;
  workItem: IpcAssessmentWorkItem;
  requestedAt?: Date;
  traceId?: string;
}

export interface IpcAutopilotOptions {
  agentGateway: AgentGateway;
  provider: AgentGatewayProvider;
  model: string;
  now?: () => Date;
}

export interface IpcAssessmentResult {
  assessmentId: string;
  gatewayRequestId: string;
  workItemId: string;
  organisationId: string;
  projectId: string;
  recommendation: IpcAssessmentRecommendation;
  riskLevel: IpcAssessmentRiskLevel;
  summary: string;
  requiredActions: readonly string[];
  sourceArtifactIds: readonly string[];
  assessedAt: Date;
}

interface GatewayAssessmentPayload {
  recommendation: IpcAssessmentRecommendation;
  riskLevel: IpcAssessmentRiskLevel;
  summary: string;
  requiredActions: readonly string[];
}

export interface IpcAutopilot {
  assess(input: IpcAutopilotInput): Promise<IpcAssessmentResult>;
}

export function createIpcAutopilot(options: IpcAutopilotOptions): IpcAutopilot {
  return {
    assess(input) {
      return assessIpcWorkItem(options, input);
    },
  };
}

export async function assessIpcWorkItem(
  options: IpcAutopilotOptions,
  input: IpcAutopilotInput,
): Promise<IpcAssessmentResult> {
  assertWorkItemReady(input.workItem);

  const requestedAt = input.requestedAt ?? options.now?.() ?? new Date();
  const response = await options.agentGateway.complete(
    toIpcAssessmentRequest(options, input, requestedAt),
  );
  const payload = parseGatewayAssessment(response);

  return {
    assessmentId: `ipc:${input.workItem.workItemId}:${input.requestId}`,
    gatewayRequestId: response.requestId,
    workItemId: input.workItem.workItemId,
    organisationId: input.workItem.organisationId,
    projectId: input.workItem.projectId,
    recommendation: payload.recommendation,
    riskLevel: payload.riskLevel,
    summary: payload.summary,
    requiredActions: payload.requiredActions,
    sourceArtifactIds: input.workItem.evidenceArtifactIds,
    assessedAt: response.completedAt,
  };
}

export function toIpcAssessmentRequest(
  options: Pick<IpcAutopilotOptions, 'provider' | 'model'>,
  input: IpcAutopilotInput,
  requestedAt: Date,
): AgentGatewayRequest {
  const metadata: AgentGatewayRequest['metadata'] = {
    requestId: input.requestId,
    organisationId: input.workItem.organisationId,
    projectId: input.workItem.projectId,
    actorUserId: input.actorUserId,
    purpose: 'payment-risk-review',
    custodyScope: 'project-joint-custody',
    policyTags: ['ipc-autopilot', 'payment-certificate', 'no-training'],
    retention: 'audit-log',
    requestedAt,
  };

  if (input.traceId !== undefined) {
    metadata.traceId = input.traceId;
  }

  return {
    provider: options.provider,
    model: options.model,
    messages: [
      {
        role: 'system',
        content:
          'Assess interim payment certificate risk for an African public works contract. Return strict JSON only.',
      },
      {
        role: 'user',
        content: JSON.stringify(toPromptPayload(input.workItem)),
      },
    ],
    metadata,
    temperature: 0.1,
    responseFormat: 'json',
  };
}

function toPromptPayload(workItem: IpcAssessmentWorkItem): Record<string, unknown> {
  return {
    task: 'ipc-assessment',
    expectedResponse: {
      recommendation: 'approve | needs-review | reject',
      riskLevel: 'low | medium | high',
      summary: 'short audit-ready rationale',
      requiredActions: ['action required before approval'],
    },
    workItem: {
      workItemId: workItem.workItemId,
      projectId: workItem.projectId,
      contractReference: workItem.contractReference,
      paymentCertificateReference: workItem.paymentCertificateReference,
      contractItem: workItem.contractItem,
      claimedAmount: workItem.claimedAmount,
      currency: workItem.currency,
      evidenceArtifactIds: workItem.evidenceArtifactIds,
      submittedByUserId: workItem.submittedByUserId,
      submittedAt: workItem.submittedAt.toISOString(),
    },
  };
}

function parseGatewayAssessment(response: AgentGatewayResponse): GatewayAssessmentPayload {
  try {
    const parsed: unknown = JSON.parse(response.content);

    if (!isGatewayAssessmentPayload(parsed)) {
      throw new Error('response shape is invalid');
    }

    return parsed;
  } catch (error) {
    throw new Error('IPC_AUTOPILOT_INVALID_GATEWAY_RESPONSE', { cause: error });
  }
}

function isGatewayAssessmentPayload(value: unknown): value is GatewayAssessmentPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecommendation(value.recommendation) &&
    isRiskLevel(value.riskLevel) &&
    typeof value.summary === 'string' &&
    value.summary.trim().length > 0 &&
    Array.isArray(value.requiredActions) &&
    value.requiredActions.every((action) => typeof action === 'string' && action.trim().length > 0)
  );
}

function isRecommendation(value: unknown): value is IpcAssessmentRecommendation {
  return value === 'approve' || value === 'needs-review' || value === 'reject';
}

function isRiskLevel(value: unknown): value is IpcAssessmentRiskLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertWorkItemReady(workItem: IpcAssessmentWorkItem): void {
  assertNonEmpty(workItem.workItemId, 'workItem.workItemId');
  assertNonEmpty(workItem.organisationId, 'workItem.organisationId');
  assertNonEmpty(workItem.projectId, 'workItem.projectId');
  assertNonEmpty(workItem.contractReference, 'workItem.contractReference');
  assertNonEmpty(workItem.paymentCertificateReference, 'workItem.paymentCertificateReference');
  assertNonEmpty(workItem.contractItem, 'workItem.contractItem');
  assertNonEmpty(workItem.currency, 'workItem.currency');
  assertNonEmpty(workItem.submittedByUserId, 'workItem.submittedByUserId');

  if (!Number.isFinite(workItem.claimedAmount) || workItem.claimedAmount <= 0) {
    throw new Error('workItem.claimedAmount must be greater than zero');
  }

  if (workItem.evidenceArtifactIds.length === 0) {
    throw new Error('workItem.evidenceArtifactIds must contain at least one artifact');
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}
