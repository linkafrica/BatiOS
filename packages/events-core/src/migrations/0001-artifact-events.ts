/**
 * Migration 0001: artifact events
 *
 * Artifact events are append-only evidence records. Writes go through
 * packages/events-core so callers get typed payloads, idempotency, and a single
 * policy boundary for compliance scanning.
 */

import { type Kysely, sql } from 'kysely';

const currentOrganisationId = sql`nullif(current_setting('batios.organisation_id', true), '')::uuid`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

  await db.schema
    .createTable('artifact_events')
    .addColumn('event_id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('artifact_id', 'uuid', (c) => c.notNull())
    .addColumn('project_id', 'uuid', (c) => c.notNull())
    .addColumn('organisation_id', 'uuid', (c) => c.notNull())
    .addColumn('event_type', 'text', (c) => c.notNull())
    .addColumn('event_version', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('occurred_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('actor_user_id', 'uuid', (c) => c.notNull())
    .addColumn('idempotency_key', 'text', (c) => c.notNull())
    .addColumn('payload', 'jsonb', (c) => c.notNull())
    .addColumn('causation_id', 'uuid')
    .addColumn('correlation_id', 'uuid')
    .addUniqueConstraint('artifact_events_org_idempotency_unique', [
      'organisation_id',
      'idempotency_key',
    ])
    .execute();

  await sql`
    ALTER TABLE artifact_events ADD CONSTRAINT artifact_events_type_chk
      CHECK (
        event_type IN (
          'artifact.created',
          'artifact.updated',
          'artifact.attached',
          'artifact.vision.observed',
          'artifact.reviewed',
          'artifact.approved',
          'artifact.rejected',
          'artifact.superseded'
        )
      )
  `.execute(db);

  await sql`
    ALTER TABLE artifact_events ADD CONSTRAINT artifact_events_version_positive_chk
      CHECK (event_version > 0)
  `.execute(db);

  await db.schema
    .createIndex('artifact_events_artifact_occurred_idx')
    .on('artifact_events')
    .columns(['artifact_id', 'occurred_at'])
    .execute();

  await db.schema
    .createIndex('artifact_events_project_occurred_idx')
    .on('artifact_events')
    .columns(['project_id', 'occurred_at'])
    .execute();

  await db.schema
    .createIndex('artifact_events_organisation_idx')
    .on('artifact_events')
    .column('organisation_id')
    .execute();

  await sql`ALTER TABLE artifact_events ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE artifact_events FORCE ROW LEVEL SECURITY`.execute(db);

  await sql`
    CREATE POLICY artifact_events_owner_read ON artifact_events
      AS PERMISSIVE
      FOR SELECT
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY artifact_events_owner_insert ON artifact_events
      AS PERMISSIVE
      FOR INSERT
      WITH CHECK (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION prevent_artifact_events_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'artifact_events is append-only';
    END;
    $$;
  `.execute(db);

  await sql`
    CREATE TRIGGER artifact_events_no_update
      BEFORE UPDATE ON artifact_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_artifact_events_mutation()
  `.execute(db);

  await sql`
    CREATE TRIGGER artifact_events_no_delete
      BEFORE DELETE ON artifact_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_artifact_events_mutation()
  `.execute(db);
}

export async function down(_db?: Kysely<unknown>): Promise<void> {
  throw new Error(
    'down migrations are not supported. Roll back by reverting to a prior snapshot and re-running migrations forward.',
  );
}
