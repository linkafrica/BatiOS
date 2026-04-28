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

| Decision                    | Value |
| --------------------------- | ----- |
| Database provider           |       |
| Region                      |       |
| Plan                        |       |
| Storage size                |       |
| App region alignment        |       |
| Backup mechanism            |       |
| Restore rehearsal target    |       |
| Expected monthly cost       |       |
| Decision owner              |       |
| Decision timestamp          |       |
| Approval link or issue note |       |

Recommended default: Fly Managed Postgres, Postgres 16, smallest acceptable
production plan, 10 GB initial storage, and an application region close to the
database region. If `jnb` is not available for Managed Postgres, choose between
moving production apps near the database or accepting cross-region latency from
`jnb`.

## Option A: Fly Managed Postgres

Use this path when Managed Postgres is available in an acceptable region. It is
preferred for production because Fly manages backups, recovery, HA/failover,
monitoring, and support.

Provision:

```bash
fly mpg create \
  --name batios-production-db \
  --org personal \
  --region <region> \
  --pg-major-version 16 \
  --plan <plan> \
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
