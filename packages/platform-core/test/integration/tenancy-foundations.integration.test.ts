import { randomUUID } from 'node:crypto';

import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migratePlatformToLatest } from '../../src/migrations/index.js';

interface TenancyTestDatabase {
  organisations: {
    organisation_id: string;
    display_name: string;
    slug: string;
    kind: string;
    country_code: string;
    status: string;
    created_at: Date;
    last_modified_at: Date;
  };
  projects: {
    project_id: string;
    organisation_id: string;
    tenant_hash: string;
    display_name: string;
    contract_reference: string;
    status: string;
    created_at: Date;
    last_modified_at: Date;
  };
  project_parties: {
    project_party_id: string;
    project_id: string;
    project_owner_organisation_id: string;
    organisation_id: string;
    tenant_hash: string;
    party_role: string;
    custody_level: string;
    granted_at: Date;
    granted_by_user_id: string | null;
    revoked_at: Date | null;
    revoked_by_user_id: string | null;
  };
}

const databaseUrl = process.env.BATIOS_TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('tenancy foundations migration', () => {
  let adminPool: Pool;
  let adminDb: Kysely<TenancyTestDatabase>;
  let appPool: Pool;
  let db: Kysely<TenancyTestDatabase>;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: databaseUrl });
    adminDb = new Kysely<TenancyTestDatabase>({
      dialect: new PostgresDialect({ pool: adminPool }),
    });

    await migratePlatformToLatest(adminDb);
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batios_app') THEN
          CREATE ROLE batios_app LOGIN PASSWORD 'batios_app';
        END IF;
      END
      $$;
    `.execute(adminDb);
    await sql`GRANT USAGE ON SCHEMA public TO batios_app`.execute(adminDb);
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO batios_app`.execute(
      adminDb,
    );

    appPool = new Pool({ connectionString: createAppDatabaseUrl(databaseUrl) });
    db = new Kysely<TenancyTestDatabase>({
      dialect: new PostgresDialect({ pool: appPool }),
    });
  });

  afterAll(async () => {
    await db.destroy();
    await adminDb.destroy();
  });

  it('enforces owner-only organisation reads and joint-custody project reads', async () => {
    const ownerOrganisationId = randomUUID();
    const custodyOrganisationId = randomUUID();
    const outsiderOrganisationId = randomUUID();
    const projectId = randomUUID();

    await sql`SELECT set_config('batios.organisation_id', ${ownerOrganisationId}, false)`.execute(
      db,
    );
    await db
      .insertInto('organisations')
      .values({
        organisation_id: ownerOrganisationId,
        display_name: 'Owner',
        slug: `owner-${projectId}`,
        kind: 'Contractor',
      })
      .execute();

    await sql`SELECT set_config('batios.organisation_id', ${custodyOrganisationId}, false)`.execute(
      db,
    );
    await db
      .insertInto('organisations')
      .values({
        organisation_id: custodyOrganisationId,
        display_name: 'Custody',
        slug: `custody-${projectId}`,
        kind: 'PM',
      })
      .execute();

    await sql`SELECT set_config('batios.organisation_id', ${outsiderOrganisationId}, false)`.execute(
      db,
    );
    await db
      .insertInto('organisations')
      .values({
        organisation_id: outsiderOrganisationId,
        display_name: 'Outsider',
        slug: `outsider-${projectId}`,
        kind: 'External',
      })
      .execute();

    await sql`SELECT set_config('batios.organisation_id', ${ownerOrganisationId}, false)`.execute(
      db,
    );
    await db
      .insertInto('projects')
      .values({
        project_id: projectId,
        organisation_id: ownerOrganisationId,
        display_name: 'RLS test project',
        contract_reference: `RLS-${projectId}`,
      })
      .execute();

    await db
      .insertInto('project_parties')
      .values({
        project_id: projectId,
        project_owner_organisation_id: ownerOrganisationId,
        organisation_id: custodyOrganisationId,
        party_role: 'PM',
      })
      .execute();

    await sql`SELECT set_config('batios.organisation_id', ${ownerOrganisationId}, false)`.execute(
      db,
    );
    await expect(db.selectFrom('organisations').selectAll().execute()).resolves.toHaveLength(1);
    await expect(db.selectFrom('projects').selectAll().execute()).resolves.toHaveLength(1);

    await sql`SELECT set_config('batios.organisation_id', ${custodyOrganisationId}, false)`.execute(
      db,
    );
    await expect(db.selectFrom('organisations').selectAll().execute()).resolves.toHaveLength(1);
    await expect(db.selectFrom('projects').selectAll().execute()).resolves.toHaveLength(1);

    await sql`SELECT set_config('batios.organisation_id', ${outsiderOrganisationId}, false)`.execute(
      db,
    );
    await expect(db.selectFrom('organisations').selectAll().execute()).resolves.toHaveLength(1);
    await expect(db.selectFrom('projects').selectAll().execute()).resolves.toHaveLength(0);
  });
});

function createAppDatabaseUrl(connectionString: string | undefined): string {
  if (!connectionString) {
    throw new Error('BATIOS_TEST_DATABASE_URL is required');
  }

  const url = new URL(connectionString);
  url.username = 'batios_app';
  url.password = 'batios_app';
  return url.toString();
}
