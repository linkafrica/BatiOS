# Production Database Runbook

This runbook controls the BatiOS production database decision, provisioning, and
backup verification on Fly.io. Do not provision paid database resources or move
production traffic until the decision record is complete.

## Current State

| Item                    | Status                                      |
| ----------------------- | ------------------------------------------- |
| Staging database        | `batios-postgres-staging`, unmanaged Fly PG |
| Staging region          | `jnb`                                       |
| Managed Postgres        | No cluster currently exists                 |
| Production database     | Not provisioned                             |
| Production backup proof | Not verified                                |

Fly platform regions include `jnb`, `fra`, `lhr`, `ams`, `iad`, `ord`, `sin`,
and others. Fly Managed Postgres availability can differ from general app
regions, so confirm the target region immediately before provisioning.

## Decision Record

Complete this before creating a production database:

| Decision                    | Value                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| Database provider           | Fly Managed Postgres                                                     |
| Region                      | `lhr`                                                                    |
| Plan                        | Basic (`basic` in `fly mpg create`)                                      |
| Storage size                | 10 GB                                                                    |
| App region alignment        | Colocate production apps in `lhr`                                        |
| Backup mechanism            | Fly Managed Postgres automated backups plus manual backup before cutover |
| Restore rehearsal target    | Separate restored Managed Postgres cluster before cutover                |
| Expected monthly cost       | About $38/month plus 10 GB provisioned storage                           |
| Decision owner              | LinkAfrica operator                                                      |
| Decision timestamp          | 2026-04-28                                                               |
| Approval link or issue note | Issue #35                                                                |

Production decision: Fly Managed Postgres, Postgres 16, Basic plan, 10 GB
initial storage, and production apps colocated in `lhr`. This avoids
application-to-database cross-region latency after cutover and keeps production
on the managed backup and recovery path.

## Option A: Fly Managed Postgres

Use this path when Managed Postgres is available in an acceptable region. It is
preferred for production because Fly manages backups, recovery, HA/failover,
monitoring, and support.

Provision:

```bash
fly mpg create \
  --name batios-production-db \
  --org personal \
  --region lhr \
  --pg-major-version 16 \
  --plan basic \
  --volume-size 10
```

Attach or set the database URL only through provider secrets. Do not commit the
connection string.

```bash
fly mpg attach <cluster-id> --app batios-field-pwa
fly mpg attach <cluster-id> --app batios-admin
fly mpg attach <cluster-id> --app batios-pm-dashboard
fly mpg attach <cluster-id> --app batios-qs-dashboard
```

Verify backups:

```bash
fly mpg backup list <cluster-id>
fly mpg backup create <cluster-id>
fly mpg backup list <cluster-id>
```

Restore rehearsal:

```bash
fly mpg restore <cluster-id> --backup-id <backup-id>
```

Record the restore target and verification result in
`docs/templates/production-release-evidence.md`.

## Option B: Unmanaged Fly Postgres

Use this path only if region affinity to `jnb` is more important than the
Managed Postgres operating model, and only after backups and restore rehearsal
are proven.

Provision:

```bash
fly postgres create \
  --name batios-postgres-production \
  --region jnb \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 10
```

Enable and verify backups:

```bash
fly postgres backup enable --app batios-postgres-production
fly postgres backup create --app batios-postgres-production
fly postgres backup list --app batios-postgres-production
```

Restore rehearsal:

```bash
fly postgres backup restore batios-postgres-production-restore \
  --app batios-postgres-production \
  --restore-target-name <backup-id>
```

Attach production apps only after the restore rehearsal succeeds.

## Go/No-Go Gate

Production database is ready only when:

- Provider, region, plan, and cost are approved in issue #35.
- `DATABASE_URL` is stored only in Fly secrets or approved secret storage.
- Backup creation is verified.
- Restore rehearsal succeeds into a separate target.
- Restore evidence is captured in the production release evidence template.
- Production smoke checks pass after apps are connected to the database.
