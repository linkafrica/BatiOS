import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import * as tenancyFoundations from './0001-tenancy-foundations.js';
import {
  PlatformMigrationProvider,
  TENANCY_FOUNDATIONS_MIGRATION_ID,
  platformMigrationIds,
} from './index.js';

describe('platform migration registry', () => {
  it('registers tenancy foundations as the first platform migration', async () => {
    const provider = new PlatformMigrationProvider();
    const migrations = await provider.getMigrations();

    expect(platformMigrationIds).toEqual([TENANCY_FOUNDATIONS_MIGRATION_ID]);
    expect(migrations[TENANCY_FOUNDATIONS_MIGRATION_ID]).toBe(tenancyFoundations);
    expect(migrations[TENANCY_FOUNDATIONS_MIGRATION_ID].up).toBeTypeOf('function');
    expect(migrations[TENANCY_FOUNDATIONS_MIGRATION_ID].down).toBeTypeOf('function');
  });

  it('keeps platform migrations forward-only', async () => {
    await expect(tenancyFoundations.down()).rejects.toThrow('down migrations are not supported');
  });

  it('keeps tenant-scoped tables protected by RLS and policies', async () => {
    const source = await readFile(
      new URL('./0001-tenancy-foundations.ts', import.meta.url),
      'utf8',
    );

    for (const table of [
      'organisations',
      'users',
      'projects',
      'project_parties',
      'project_roles',
    ]) {
      expect(source).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(source).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }

    for (const policy of [
      'organisations_self_read',
      'users_owner_read',
      'projects_owner_read',
      'projects_joint_custody_read',
      'project_parties_participant_read',
      'project_roles_owner_read',
    ]) {
      expect(source).toContain(`CREATE POLICY ${policy}`);
    }
  });
});
