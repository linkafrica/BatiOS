export const evidenceVisionBoundary = 'evidence-vision';

export type EvidenceVisionProvider = 'local' | 'openai' | 'google' | 'aws' | 'azure';

export type EvidenceVisionPurpose =
  | 'site-progress-verification'
  | 'defect-detection'
  | 'safety-compliance'
  | 'quantity-assistance'
  | 'tamper-screening'
  | 'before-after-comparison';

export type EvidenceVisionCustodyScope =
  | 'tenant-only'
  | 'project-joint-custody'
  | 'public-reference';

export type EvidenceVisionArtifactType = 'image' | 'video' | 'image-sequence';

export type EvidenceVisionObservationKind =
  | 'progress-indicator'
  | 'defect-risk'
  | 'safety-risk'
  | 'quantity-estimate'
  | 'integrity-signal'
  | 'scene-change'
  | 'unknown';

export interface EvidenceVisionArtifact {
  artifactId: string;
  type: EvidenceVisionArtifactType;
  uri: string;
  sha256?: string;
  capturedAt?: Date;
  capturedByUserId?: string;
  location?: EvidenceVisionLocation;
  declaredWorkItemId?: string;
}

export interface EvidenceVisionLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface EvidenceVisionRequestMetadata {
  requestId: string;
  organisationId: string;
  projectId: string;
  actorUserId: string;
  purpose: EvidenceVisionPurpose;
  custodyScope: EvidenceVisionCustodyScope;
  policyTags: readonly string[];
  retention: 'audit-log' | 'case-record';
  requestedAt: Date;
  traceId?: string;
}

export interface EvidenceVisionRequest {
  provider: EvidenceVisionProvider;
  model: string;
  artifacts: readonly EvidenceVisionArtifact[];
  metadata: EvidenceVisionRequestMetadata;
  comparisonArtifactIds?: readonly string[];
  instructions?: string;
}

export interface EvidenceVisionObservation {
  observationId: string;
  artifactId: string;
  kind: EvidenceVisionObservationKind;
  label: string;
  summary: string;
  confidence: number;
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
  boundingBox?: EvidenceVisionBoundingBox;
  measuredValue?: EvidenceVisionMeasuredValue;
  reviewRequired: boolean;
  recommendedAction?: string;
}

export interface EvidenceVisionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceVisionMeasuredValue {
  value: number;
  unit: string;
  qualifier: 'estimated' | 'detected' | 'declared';
}

export interface EvidenceVisionResponse {
  requestId: string;
  provider: EvidenceVisionProvider;
  model: string;
  observations: readonly EvidenceVisionObservation[];
  provenance: EvidenceVisionProvenance;
  completedAt: Date;
}

export interface EvidenceVisionProvenance {
  sourceArtifactIds: readonly string[];
  modelVersion?: string;
  providerResponseId?: string;
  promptHash?: string;
}

export interface EvidenceVisionAuditEvent {
  requestId: string;
  organisationId: string;
  projectId: string;
  actorUserId: string;
  provider: EvidenceVisionProvider;
  model: string;
  purpose: EvidenceVisionPurpose;
  custodyScope: EvidenceVisionCustodyScope;
  policyTags: readonly string[];
  retention: EvidenceVisionRequestMetadata['retention'];
  artifactIds: readonly string[];
  traceId?: string;
  requestedAt: Date;
  completedAt?: Date;
  outcome: 'accepted' | 'rejected' | 'completed' | 'failed';
  reason?: string;
  observationCount?: number;
  reviewRequired?: boolean;
}

export interface EvidenceVisionProviderClient {
  analyze(request: EvidenceVisionRequest): Promise<EvidenceVisionResponse>;
}

export interface EvidenceVisionAuditSink {
  record(event: EvidenceVisionAuditEvent): Promise<void>;
}

export interface EvidenceVisionPolicy {
  evaluate(request: EvidenceVisionRequest): Promise<EvidenceVisionPolicyDecision>;
}

export interface EvidenceVisionPolicyDecision {
  allowed: boolean;
  reason?: string;
}

export interface EvidenceVision {
  analyze(request: EvidenceVisionRequest): Promise<EvidenceVisionResponse>;
}

export interface CreateEvidenceVisionOptions {
  providers: Readonly<Record<EvidenceVisionProvider, EvidenceVisionProviderClient | undefined>>;
  auditSink: EvidenceVisionAuditSink;
  policy?: EvidenceVisionPolicy;
  now?: () => Date;
}

const allowAllPolicy: EvidenceVisionPolicy = {
  async evaluate(): Promise<EvidenceVisionPolicyDecision> {
    return { allowed: true };
  },
};

export function createEvidenceVision(options: CreateEvidenceVisionOptions): EvidenceVision {
  const policy = options.policy ?? allowAllPolicy;
  const now = options.now ?? (() => new Date());

  return {
    async analyze(request) {
      assertAuditableVisionRequest(request);

      const provider = options.providers[request.provider];
      if (provider === undefined) {
        const reason = `vision provider ${request.provider} is not configured`;
        await options.auditSink.record(toAuditEvent(request, 'rejected', { reason }));
        throw new Error(reason);
      }

      const decision = await policy.evaluate(request);
      if (!decision.allowed) {
        const reason = decision.reason ?? 'request rejected by evidence vision policy';
        await options.auditSink.record(toAuditEvent(request, 'rejected', { reason }));
        throw new Error(reason);
      }

      await options.auditSink.record(toAuditEvent(request, 'accepted'));

      try {
        const response = await provider.analyze(request);
        const completedAt = response.completedAt ?? now();
        const observations = response.observations.map(normalizeObservation);
        const completedAudit: Pick<
          EvidenceVisionAuditEvent,
          'completedAt' | 'observationCount' | 'reviewRequired'
        > = {
          completedAt,
          observationCount: observations.length,
          reviewRequired: observations.some((observation) => observation.reviewRequired),
        };

        await options.auditSink.record(toAuditEvent(request, 'completed', completedAudit));

        return {
          ...response,
          requestId: request.metadata.requestId,
          provider: request.provider,
          model: request.model,
          observations,
          provenance: {
            ...response.provenance,
            sourceArtifactIds: request.artifacts.map((artifact) => artifact.artifactId),
          },
          completedAt,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'vision provider request failed';
        await options.auditSink.record(toAuditEvent(request, 'failed', { reason }));
        throw error;
      }
    },
  };
}

export function assertAuditableVisionRequest(request: EvidenceVisionRequest): void {
  assertPresent(request.metadata.requestId, 'metadata.requestId');
  assertPresent(request.metadata.organisationId, 'metadata.organisationId');
  assertPresent(request.metadata.projectId, 'metadata.projectId');
  assertPresent(request.metadata.actorUserId, 'metadata.actorUserId');
  assertPresent(request.metadata.purpose, 'metadata.purpose');
  assertPresent(request.metadata.custodyScope, 'metadata.custodyScope');
  assertPresent(request.metadata.retention, 'metadata.retention');
  assertPresent(request.provider, 'provider');
  assertPresent(request.model, 'model');

  if (request.artifacts.length === 0) {
    throw new Error('artifacts must contain at least one artifact');
  }

  if (request.metadata.policyTags.length === 0) {
    throw new Error('metadata.policyTags must contain at least one policy tag');
  }

  for (const artifact of request.artifacts) {
    assertPresent(artifact.artifactId, 'artifact.artifactId');
    assertPresent(artifact.type, 'artifact.type');
    assertPresent(artifact.uri, 'artifact.uri');
  }
}

export function requiresHumanReview(observations: readonly EvidenceVisionObservation[]): boolean {
  return observations.some(
    (observation) => observation.reviewRequired || observation.confidence < 0.85,
  );
}

function normalizeObservation(observation: EvidenceVisionObservation): EvidenceVisionObservation {
  if (observation.confidence < 0 || observation.confidence > 1) {
    throw new Error('observation confidence must be between 0 and 1');
  }

  return {
    ...observation,
    reviewRequired: observation.reviewRequired || observation.confidence < 0.85,
  };
}

function assertPresent(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function toAuditEvent(
  request: EvidenceVisionRequest,
  outcome: EvidenceVisionAuditEvent['outcome'],
  extras: Pick<
    EvidenceVisionAuditEvent,
    'completedAt' | 'observationCount' | 'reason' | 'reviewRequired'
  > = {},
): EvidenceVisionAuditEvent {
  const event: EvidenceVisionAuditEvent = {
    requestId: request.metadata.requestId,
    organisationId: request.metadata.organisationId,
    projectId: request.metadata.projectId,
    actorUserId: request.metadata.actorUserId,
    provider: request.provider,
    model: request.model,
    purpose: request.metadata.purpose,
    custodyScope: request.metadata.custodyScope,
    policyTags: request.metadata.policyTags,
    retention: request.metadata.retention,
    artifactIds: request.artifacts.map((artifact) => artifact.artifactId),
    requestedAt: request.metadata.requestedAt,
    outcome,
  };

  if (request.metadata.traceId !== undefined) {
    event.traceId = request.metadata.traceId;
  }

  if (extras.completedAt !== undefined) {
    event.completedAt = extras.completedAt;
  }

  if (extras.observationCount !== undefined) {
    event.observationCount = extras.observationCount;
  }

  if (extras.reason !== undefined) {
    event.reason = extras.reason;
  }

  if (extras.reviewRequired !== undefined) {
    event.reviewRequired = extras.reviewRequired;
  }

  return event;
}
