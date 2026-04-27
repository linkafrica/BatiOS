/**
 * Migration 0001: tenancy foundations
 *
 * ILLUSTRATIVE ONLY. NOT PRODUCTION.
 *
 * Scope (per build plan Session 1.2.B1):
 * - organisations, users, projects, project_parties, project_roles tables.
 * - Tenant-scoped tables carry organisation_id. Project-scoped tables also carry
 *   project_id and tenant_hash where the row naturally belongs to a project.
 * - RLS pattern:
 *     1. owner_read: PERMISSIVE FOR SELECT.
 *     2. joint_custody_read: PERMISSIVE FOR SELECT where project participation applies.
 *     3. owner_write: PERMISSIVE write policies that actually grant writes.
 *
 * Important correction:
 * - RESTRICTIVE policies do not grant access. They only constrain already-granted
 *   permissive policies. Owner write policies below are therefore PERMISSIVE.
 * - Joint custody is normalized into project_parties instead of uuid[] columns.
 *   Arrays are poor custody records: no FK enforcement, weak audit semantics, and
 *   annoying queries. The database should not need tarot cards to prove custody.
 *
 * Postgres version: 16.x.
 */

import { type Kysely, sql } from 'kysely';

const currentOrganisationId = sql`nullif(current_setting('batios.organisation_id', true), '')::uuid`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

  // ---------------------------------------------------------------------------
  // organisations: tenant root metadata

  // ---------------------------------------------------------------------------

  await db.schema
    .createTable('organisations')
    .addColumn('organisation_id', 'uuid', (c) => c.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('display_name', 'text', (c) => c.notNull())
    .addColumn('slug', 'text', (c) => c.notNull().unique())
    .addColumn('kind', 'text', (c) => c.notNull())
    .addColumn('country_code', 'text', (c) => c.notNull().defaultTo('GH'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('active'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('last_modified_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`
    ALTER TABLE organisations ADD CONSTRAINT organisations_kind_chk
      CHECK (kind IN ('Contractor', 'PM', 'Employer', 'Platform', 'External'))
  `.execute(db);

  // Keep organisation metadata protected at the DB layer. Public lookups should
  // be exposed through an API/view, not by leaving the base table unguarded.
  await sql`ALTER TABLE organisations ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE organisations FORCE ROW LEVEL SECURITY`.execute(db);

  await sql`
    CREATE POLICY organisations_self_read ON organisations
      AS PERMISSIVE
      FOR SELECT
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY organisations_self_insert ON organisations
      AS PERMISSIVE
      FOR INSERT
      WITH CHECK (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY organisations_self_update ON organisations
      AS PERMISSIVE
      FOR UPDATE
      USING (organisation_id = ${currentOrganisationId})
      WITH CHECK (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY organisations_self_delete ON organisations
      AS PERMISSIVE
      FOR DELETE
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);

  // ---------------------------------------------------------------------------
  // users: identity within an organisation

  // ---------------------------------------------------------------------------

  await db.schema
    .createTable('users')
    .addColumn('user_id', 'uuid', (c) => c.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('organisation_id', 'uuid', (c) =>
      c.notNull().references('organisations.organisation_id').onDelete('restrict'),
    )
    .addColumn('email', 'text', (c) => c.notNull())
    .addColumn('display_name', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('active'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('last_login_at', 'timestamptz')
    .addUniqueConstraint('users_email_per_org', ['organisation_id', 'email'])
    .addUniqueConstraint('users_user_org_unique', ['user_id', 'organisation_id'])
    .execute();

  await db.schema
    .createIndex('users_organisation_idx')
    .on('users')
    .column('organisation_id')
    .execute();

  await sql`ALTER TABLE users ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE users FORCE ROW LEVEL SECURITY`.execute(db);

  await sql`
    CREATE POLICY users_owner_read ON users
      AS PERMISSIVE
      FOR SELECT
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY users_owner_insert ON users
      AS PERMISSIVE
      FOR INSERT
      WITH CHECK (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY users_owner_update ON users
      AS PERMISSIVE
      FOR UPDATE
      USING (organisation_id = ${currentOrganisationId})
      WITH CHECK (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY users_owner_delete ON users
      AS PERMISSIVE
      FOR DELETE
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);

  // ---------------------------------------------------------------------------
  // projects: owned by one organisation, readable by active custody parties

  // ---------------------------------------------------------------------------

  await db.schema
    .createTable('projects')
    .addColumn('project_id', 'uuid', (c) => c.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('organisation_id', 'uuid', (c) =>
      c.notNull().references('organisations.organisation_id').onDelete('restrict'),
    )
    .addColumn('tenant_hash', 'text', (c) =>
      c
        .notNull()
        .generatedAlwaysAs(
          sql`encode(digest(organisation_id::text || ':' || project_id::text, 'sha256'), 'hex')`,
        ),
    )
    .addColumn('display_name', 'text', (c) => c.notNull())
    .addColumn('contract_reference', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('active'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('last_modified_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('projects_project_owner_unique', ['project_id', 'organisation_id'])
    .execute();

  await db.schema
    .createIndex('projects_organisation_idx')
    .on('projects')
    .column('organisation_id')
    .execute();

  await sql`ALTER TABLE projects ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE projects FORCE ROW LEVEL SECURITY`.execute(db);

  await sql`
    CREATE POLICY projects_owner_read ON projects
      AS PERMISSIVE
      FOR SELECT
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY projects_owner_insert ON projects
      AS PERMISSIVE
      FOR INSERT
      WITH CHECK (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY projects_owner_update ON projects
      AS PERMISSIVE
      FOR UPDATE
      USING (organisation_id = ${currentOrganisationId})
      WITH CHECK (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY projects_owner_delete ON projects
      AS PERMISSIVE
      FOR DELETE
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);

  // ---------------------------------------------------------------------------
  // project_parties: normalized joint custody register

  // ---------------------------------------------------------------------------

  await db.schema
    .createTable('project_parties')
    .addColumn('project_party_id', 'uuid', (c) => c.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('project_id', 'uuid', (c) => c.notNull())
    .addColumn('project_owner_organisation_id', 'uuid', (c) => c.notNull())
    .addColumn('organisation_id', 'uuid', (c) =>
      c.notNull().references('organisations.organisation_id').onDelete('restrict'),
    )
    .addColumn('tenant_hash', 'text', (c) =>
      c
        .notNull()
        .generatedAlwaysAs(
          sql`encode(digest(organisation_id::text || ':' || project_id::text, 'sha256'), 'hex')`,
        ),
    )
    .addColumn('party_role', 'text', (c) => c.notNull())
    .addColumn('custody_level', 'text', (c) => c.notNull().defaultTo('read'))
    .addColumn('granted_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('granted_by_user_id', 'uuid', (c) => c.references('users.user_id'))
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('revoked_by_user_id', 'uuid', (c) => c.references('users.user_id'))
    .addUniqueConstraint('project_parties_project_org_unique', ['project_id', 'organisation_id'])
    .execute();

  await sql`
    ALTER TABLE project_parties
      ADD CONSTRAINT project_parties_project_owner_fk
      FOREIGN KEY (project_id, project_owner_organisation_id)
      REFERENCES projects (project_id, organisation_id)
      ON DELETE RESTRICT
  `.execute(db);

  await sql`
    ALTER TABLE project_parties ADD CONSTRAINT project_parties_role_chk
      CHECK (party_role IN ('Owner', 'Contractor', 'PM', 'Employer', 'External'))
  `.execute(db);

  await sql`
    ALTER TABLE project_parties ADD CONSTRAINT project_parties_custody_level_chk
      CHECK (custody_level IN ('read', 'comment', 'approve', 'admin'))
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX project_parties_unique_active
      ON project_parties (project_id, organisation_id, party_role)
      WHERE revoked_at IS NULL
  `.execute(db);

  await db.schema
    .createIndex('project_parties_project_idx')
    .on('project_parties')
    .column('project_id')
    .execute();
  await db.schema
    .createIndex('project_parties_organisation_idx')
    .on('project_parties')
    .column('organisation_id')
    .execute();
  await db.schema
    .createIndex('project_parties_owner_idx')
    .on('project_parties')
    .column('project_owner_organisation_id')
    .execute();

  await sql`ALTER TABLE project_parties ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE project_parties FORCE ROW LEVEL SECURITY`.execute(db);

  await sql`
    CREATE POLICY project_parties_participant_read ON project_parties
      AS PERMISSIVE
      FOR SELECT
      USING (
        organisation_id = ${currentOrganisationId}
        OR project_owner_organisation_id = ${currentOrganisationId}
      )
  `.execute(db);

  await sql`
    CREATE POLICY project_parties_owner_insert ON project_parties
      AS PERMISSIVE
      FOR INSERT
      WITH CHECK (project_owner_organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY project_parties_owner_update ON project_parties
      AS PERMISSIVE
      FOR UPDATE
      USING (project_owner_organisation_id = ${currentOrganisationId})
      WITH CHECK (project_owner_organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY project_parties_owner_delete ON project_parties
      AS PERMISSIVE
      FOR DELETE
      USING (project_owner_organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY projects_joint_custody_read ON projects
      AS PERMISSIVE
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM project_parties pp
          WHERE pp.project_id = projects.project_id
            AND pp.organisation_id = ${currentOrganisationId}
            AND pp.revoked_at IS NULL
        )
      )
  `.execute(db);

  // ---------------------------------------------------------------------------
  // project_roles: role assignment matrix per (user, project)

  // ---------------------------------------------------------------------------

  await db.schema
    .createTable('project_roles')
    .addColumn('project_role_id', 'uuid', (c) => c.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn('user_id', 'uuid', (c) => c.notNull())
    .addColumn('project_id', 'uuid', (c) => c.notNull())
    .addColumn('organisation_id', 'uuid', (c) => c.notNull())
    .addColumn('tenant_hash', 'text', (c) =>
      c
        .notNull()
        .generatedAlwaysAs(
          sql`encode(digest(organisation_id::text || ':' || project_id::text, 'sha256'), 'hex')`,
        ),
    )
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('granted_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('granted_by_user_id', 'uuid', (c) => c.references('users.user_id'))
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('revoked_by_user_id', 'uuid', (c) => c.references('users.user_id'))
    .execute();

  await sql`
    ALTER TABLE project_roles
      ADD CONSTRAINT project_roles_user_org_fk
      FOREIGN KEY (user_id, organisation_id)
      REFERENCES users (user_id, organisation_id)
      ON DELETE RESTRICT
  `.execute(db);

  await sql`
    ALTER TABLE project_roles
      ADD CONSTRAINT project_roles_project_party_fk
      FOREIGN KEY (project_id, organisation_id)
      REFERENCES project_parties (project_id, organisation_id)
      ON DELETE RESTRICT
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX project_roles_unique_active
      ON project_roles (user_id, project_id, role)
      WHERE revoked_at IS NULL
  `.execute(db);

  await db.schema
    .createIndex('project_roles_user_project_idx')
    .on('project_roles')
    .columns(['user_id', 'project_id'])
    .execute();

  await db.schema
    .createIndex('project_roles_project_idx')
    .on('project_roles')
    .column('project_id')
    .execute();
  await db.schema
    .createIndex('project_roles_organisation_idx')
    .on('project_roles')
    .column('organisation_id')
    .execute();

  await sql`ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE project_roles FORCE ROW LEVEL SECURITY`.execute(db);

  await sql`
    CREATE POLICY project_roles_owner_read ON project_roles
      AS PERMISSIVE
      FOR SELECT
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);

  await sql`
    CREATE POLICY project_roles_owner_insert ON project_roles
      AS PERMISSIVE
      FOR INSERT
      WITH CHECK (
        organisation_id = ${currentOrganisationId}
        AND EXISTS (
          SELECT 1
          FROM project_parties pp
          WHERE pp.project_id = project_roles.project_id
            AND pp.organisation_id = project_roles.organisation_id
            AND pp.revoked_at IS NULL
        )
      )
  `.execute(db);

  await sql`
    CREATE POLICY project_roles_owner_update ON project_roles
      AS PERMISSIVE
      FOR UPDATE
      USING (organisation_id = ${currentOrganisationId})
      WITH CHECK (
        organisation_id = ${currentOrganisationId}
        AND EXISTS (
          SELECT 1
          FROM project_parties pp
          WHERE pp.project_id = project_roles.project_id
            AND pp.organisation_id = project_roles.organisation_id
            AND pp.revoked_at IS NULL
        )
      )
  `.execute(db);

  await sql`
    CREATE POLICY project_roles_owner_delete ON project_roles
      AS PERMISSIVE
      FOR DELETE
      USING (organisation_id = ${currentOrganisationId})
  `.execute(db);
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // No down migrations per platform architecture. Roll back by restoring a prior
  // snapshot and re-running migrations forward.
  throw new Error(
    'down migrations are not supported. Roll back by reverting to a prior snapshot and re-running migrations forward.',
  );
}
