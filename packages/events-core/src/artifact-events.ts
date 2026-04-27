import { type Generated, type Insertable, type Kysely, type Selectable } from 'kysely';

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
  | 'artifact.reviewed'
  | 'artifact.approved'
  | 'artifact.rejected'
  | 'artifact.superseded';

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
