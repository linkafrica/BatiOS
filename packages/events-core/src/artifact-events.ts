import { type Generated, type Insertable, type Kysely, type Selectable } from 'kysely';
import {
  requiresHumanReview,
  type EvidenceVisionObservation,
  type EvidenceVisionResponse,
} from '@batios/evidence-vision';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type ArtifactEventPayload = Readonly<Record<string, JsonValue>>;

export type ArtifactEventType =
  | 'artifact.created'
  | 'artifact.updated'
  | 'artifact.attached'
  | 'artifact.vision.observed'
  | 'artifact.reviewed'
  | 'artifact.approved'
  | 'artifact.rejected'
  | 'artifact.superseded';

export interface VisionObservationArtifactEventOptions {
  response: EvidenceVisionResponse;
  artifactId: string;
  projectId: string;
  organisationId: string;
  actorUserId: string;
  idempotencyKey?: string;
  occurredAt?: Date;
  causationId?: string | null;
  correlationId?: string | null;
}

export interface ArtifactEventsTable {
  event_id: Generated<string>;
  artifact_id: string;
  project_id: string;
  organisation_id: string;
  event_type: ArtifactEventType;
  event_version: Generated<number>;
  occurred_at: Generated<Date>;
  actor_user_id: string;
  idempotency_key: string;
  payload: ArtifactEventPayload;
  causation_id: string | null;
  correlation_id: string | null;
}

export interface ArtifactEventsDatabase {
  artifact_events: ArtifactEventsTable;
}

export interface ArtifactEventInput {
  eventId?: string;
  artifactId: string;
  projectId: string;
  organisationId: string;
  eventType: ArtifactEventType;
  eventVersion?: number;
  occurredAt?: Date;
  actorUserId: string;
  idempotencyKey: string;
  payload: ArtifactEventPayload;
  causationId?: string | null;
  correlationId?: string | null;
}

export type ArtifactEventInsert = Insertable<ArtifactEventsTable>;
export type ArtifactEventRow = Selectable<ArtifactEventsTable>;

export function toArtifactEventInsert(input: ArtifactEventInput): ArtifactEventInsert {
  const insert: ArtifactEventInsert = {
    artifact_id: input.artifactId,
    project_id: input.projectId,
    organisation_id: input.organisationId,
    event_type: input.eventType,
    event_version: input.eventVersion ?? 1,
    occurred_at: input.occurredAt ?? new Date(),
    actor_user_id: input.actorUserId,
    idempotency_key: input.idempotencyKey,
    payload: input.payload,
    causation_id: input.causationId ?? null,
    correlation_id: input.correlationId ?? null,
  };

  if (input.eventId !== undefined) {
    insert.event_id = input.eventId;
  }

  return insert;
}

export function toVisionObservationArtifactEventInput(
  options: VisionObservationArtifactEventOptions,
): ArtifactEventInput {
  const observations = options.response.observations.filter(
    (observation) => observation.artifactId === options.artifactId,
  );

  if (observations.length === 0) {
    throw new Error(`vision response contains no observations for artifact ${options.artifactId}`);
  }

  return {
    artifactId: options.artifactId,
    projectId: options.projectId,
    organisationId: options.organisationId,
    eventType: 'artifact.vision.observed',
    occurredAt: options.occurredAt ?? options.response.completedAt,
    actorUserId: options.actorUserId,
    idempotencyKey:
      options.idempotencyKey ??
      `artifact:${options.artifactId}:vision:${options.response.requestId}:${options.response.model}`,
    payload: toVisionObservationPayload(options.response, options.artifactId, observations),
    causationId: options.causationId ?? null,
    correlationId: options.correlationId ?? null,
  };
}

function toVisionObservationPayload(
  response: EvidenceVisionResponse,
  artifactId: string,
  observations: readonly EvidenceVisionObservation[],
): ArtifactEventPayload {
  return {
    requestId: response.requestId,
    provider: response.provider,
    model: response.model,
    completedAt: response.completedAt.toISOString(),
    artifactId,
    sourceArtifactIds: response.provenance.sourceArtifactIds,
    modelVersion: response.provenance.modelVersion ?? null,
    providerResponseId: response.provenance.providerResponseId ?? null,
    promptHash: response.provenance.promptHash ?? null,
    observationCount: observations.length,
    reviewRequired: requiresHumanReview(observations),
    observations: observations.map(
      (observation): ArtifactEventPayload => ({
        observationId: observation.observationId,
        artifactId: observation.artifactId,
        kind: observation.kind,
        label: observation.label,
        summary: observation.summary,
        confidence: observation.confidence,
        severity: observation.severity ?? null,
        boundingBox:
          observation.boundingBox === undefined
            ? null
            : {
                x: observation.boundingBox.x,
                y: observation.boundingBox.y,
                width: observation.boundingBox.width,
                height: observation.boundingBox.height,
              },
        measuredValue:
          observation.measuredValue === undefined
            ? null
            : {
                value: observation.measuredValue.value,
                unit: observation.measuredValue.unit,
                qualifier: observation.measuredValue.qualifier,
              },
        reviewRequired: observation.reviewRequired,
        recommendedAction: observation.recommendedAction ?? null,
      }),
    ),
  };
}

export async function appendArtifactEvent(
  db: Kysely<ArtifactEventsDatabase>,
  input: ArtifactEventInput,
): Promise<ArtifactEventRow> {
  return await db
    .insertInto('artifact_events')
    .values(toArtifactEventInsert(input))
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function createArtifactEventsRepository(db: Kysely<ArtifactEventsDatabase>): {
  append: (input: ArtifactEventInput) => Promise<ArtifactEventRow>;
} {
  return {
    append: (input) => appendArtifactEvent(db, input),
  };
}
