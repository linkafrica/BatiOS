# Fly.io Deployment

BatiOS deploys to Fly.io as four Next.js apps plus one PostgreSQL 16 database.
Each app uses the shared Dockerfile at `deploy/fly/Dockerfile.next` and its own
Fly config.

## Apps

| Surface      | Fly config                         | Staging app name              |
| ------------ | ---------------------------------- | ----------------------------- |
| Field PWA    | `deploy/fly/field-pwa.fly.toml`    | `batios-field-pwa-staging`    |
| Admin        | `deploy/fly/admin.fly.toml`        | `batios-admin-staging`        |
| PM dashboard | `deploy/fly/pm-dashboard.fly.toml` | `batios-pm-dashboard-staging` |
| QS dashboard | `deploy/fly/qs-dashboard.fly.toml` | `batios-qs-dashboard-staging` |

## One-Time Setup

Install and authenticate the Fly CLI:

```bash
fly auth login
```

Create the staging Postgres app:

```bash
fly postgres create \
  --name batios-postgres-staging \
  --region jnb \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 10
```

Enable managed backups before production cutover. Some Fly CLI versions require
Tigris terms acceptance before `--enable-backups` works during `postgres create`;
use the Fly dashboard, a newer CLI, or Managed Postgres if the CLI cannot enable
backups non-interactively.

Create the four staging apps without deploying:

```bash
fly apps create batios-field-pwa-staging
fly apps create batios-admin-staging
fly apps create batios-pm-dashboard-staging
fly apps create batios-qs-dashboard-staging
```

Set required runtime secrets on each app. Use the generated Fly Postgres
connection string for `DATABASE_URL`.

```bash
fly secrets set \
  DATABASE_URL="postgres://..." \
  BATIOS_ORGANISATION_ID="00000000-0000-0000-0000-000000000000" \
  BATIOS_SESSION_SECRET="replace-with-32-byte-random-secret" \
  --app batios-field-pwa-staging
```

Repeat `fly secrets set` for the Admin, PM, and QS apps.

## Deploy

Deploy each app from the repository root:

```bash
fly deploy --config deploy/fly/field-pwa.fly.toml
fly deploy --config deploy/fly/admin.fly.toml
fly deploy --config deploy/fly/pm-dashboard.fly.toml
fly deploy --config deploy/fly/qs-dashboard.fly.toml
```

## Verify

Export staging URLs and run the smoke check:

```bash
export BATIOS_FIELD_PWA_URL="https://batios-field-pwa-staging.fly.dev"
export BATIOS_ADMIN_URL="https://batios-admin-staging.fly.dev"
export BATIOS_PM_DASHBOARD_URL="https://batios-pm-dashboard-staging.fly.dev"
export BATIOS_QS_DASHBOARD_URL="https://batios-qs-dashboard-staging.fly.dev"

corepack pnpm staging:smoke
```

The smoke check calls each app's `/healthz` endpoint and validates the JSON
health contract.
