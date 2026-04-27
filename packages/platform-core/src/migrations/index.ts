import { type Kysely, type Migration, Migrator, type MigrationProvider } from 'kysely';

import * as tenancyFoundations from './0001-tenancy-foundations.js';

export const TENANCY_FOUNDATIONS_MIGRATION_ID = '0001-tenancy-foundations';

export const platformMigrationIds = [TENANCY_FOUNDATIONS_MIGRATION_ID] as const;

export type PlatformMigrationId = (typeof platformMigrationIds)[number];

export class PlatformMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<PlatformMigrationId, Migration>> {
    return {
      [TENANCY_FOUNDATIONS_MIGRATION_ID]: tenancyFoundations,
    };
  }
}

export function createPlatformMigrator(db: Kysely<unknown>): Migrator {
  return new Migrator({
    db,
    provider: new PlatformMigrationProvider(),
    migrationTableName: 'platform_migrations',
    migrationLockTableName: 'platform_migration_lock',
  });
}

export async function migratePlatformToLatest(db: Kysely<unknown>): Promise<void> {
  const migrator = createPlatformMigrator(db);
  const { error } = await migrator.migrateToLatest();

  if (error) {
    throw error;
  }
}
