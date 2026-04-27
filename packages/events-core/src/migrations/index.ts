import { type Kysely, type Migration, Migrator, type MigrationProvider } from 'kysely';

import * as artifactEvents from './0001-artifact-events.js';

export const ARTIFACT_EVENTS_MIGRATION_ID = '0001-artifact-events';

export const eventsMigrationIds = [ARTIFACT_EVENTS_MIGRATION_ID] as const;

export type EventsMigrationId = (typeof eventsMigrationIds)[number];

export class EventsMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<EventsMigrationId, Migration>> {
    return {
      [ARTIFACT_EVENTS_MIGRATION_ID]: artifactEvents,
    };
  }
}

export function createEventsMigrator(db: Kysely<unknown>): Migrator {
  return new Migrator({
    db,
    provider: new EventsMigrationProvider(),
    migrationTableName: 'events_migrations',
    migrationLockTableName: 'events_migration_lock',
  });
}

export async function migrateEventsToLatest(db: Kysely<unknown>): Promise<void> {
  const migrator = createEventsMigrator(db);
  const { error } = await migrator.migrateToLatest();

  if (error) {
    throw error;
  }
}
