# Production Cutover Checklist

This checklist promotes the Fly.io staging deployment into a production-ready
operating model. Do not route real users or critical data to production until
every required item is complete.

## Production Surfaces

| Surface      | Fly config                                    | Production app name   | Example domain         |
| ------------ | --------------------------------------------- | --------------------- | ---------------------- |
| Field PWA    | `deploy/fly/field-pwa.production.fly.toml`    | `batios-field-pwa`    | `field.batios.example` |
| Admin        | `deploy/fly/admin.production.fly.toml`        | `batios-admin`        | `admin.batios.example` |
| PM dashboard | `deploy/fly/pm-dashboard.production.fly.toml` | `batios-pm-dashboard` | `pm.batios.example`    |
| QS dashboard | `deploy/fly/qs-dashboard.production.fly.toml` | `batios-qs-dashboard` | `qs.batios.example`    |

Production configs intentionally set `BATIOS_ENVIRONMENT=production`,
`auto_stop_machines="off"`, and `min_machines_running=1` so production traffic
does not wait for cold starts. Revisit machine count, memory, and CPU after the
first real load profile is measured.

## Database Gate

Production must use a verified backup and restore path before cutover.

Recommended path:

1. Provision Fly Managed Postgres for production.
2. Store the Managed Postgres connection string as `DATABASE_URL` on each
   production app.
3. Verify automated backups are enabled in Fly.
4. Perform a restore rehearsal into a separate database or cluster.
5. Record the restore timestamp, operator, and verification result in the
   release notes.

Fallback path for unmanaged Fly Postgres:

1. Enable backups with `fly postgres backup enable --app <postgres-app>`.
2. Create a manual backup with `fly postgres backup create --app <postgres-app>`.
3. List backups with `fly postgres backup list --app <postgres-app>`.
4. Restore into a new cluster with `fly postgres backup restore`.
5. Attach a non-production app to the restored database and run smoke checks.

If backup enablement is blocked by CLI or account terms, stop the cutover and
resolve it in the Fly dashboard or with Fly support. Do not accept volume
snapshots alone as the only production recovery path.

## Secret Checklist

Set these values through Fly secrets or another approved provider secret store.
Never commit real values.

| Name                            | Required | Production rule                                       |
| ------------------------------- | -------- | ----------------------------------------------------- |
| `DATABASE_URL`                  | Yes      | Production database only; no staging credentials.     |
| `BATIOS_ORGANISATION_ID`        | Yes      | Real default organisation or controlled bootstrap ID. |
| `BATIOS_SESSION_SECRET`         | Yes      | Unique 32-byte minimum random value.                  |
| `BATIOS_AGENT_GATEWAY_PROVIDER` | Optional | Real provider only after audit path is approved.      |
| `BATIOS_AGENT_GATEWAY_MODEL`    | Optional | Production-approved model identifier.                 |

Use `.env.production.example` only as the shape of required configuration.

## App Provisioning

Create production apps once:

```bash
fly apps create batios-field-pwa
fly apps create batios-admin
fly apps create batios-pm-dashboard
fly apps create batios-qs-dashboard
```

Set secrets on each app:

```bash
fly secrets set \
  DATABASE_URL="postgres://..." \
  BATIOS_ORGANISATION_ID="00000000-0000-0000-0000-000000000000" \
  BATIOS_SESSION_SECRET="replace-with-production-secret" \
  BATIOS_AGENT_GATEWAY_PROVIDER="local" \
  BATIOS_AGENT_GATEWAY_MODEL="batios-local-production" \
  --app batios-field-pwa
```

Repeat for Admin, PM dashboard, and QS dashboard.

Deploy from a protected, reviewed commit:

```bash
fly deploy --config deploy/fly/field-pwa.production.fly.toml
fly deploy --config deploy/fly/admin.production.fly.toml
fly deploy --config deploy/fly/pm-dashboard.production.fly.toml
fly deploy --config deploy/fly/qs-dashboard.production.fly.toml
```

## Domains And TLS

Attach custom domains after each app deploy succeeds:

```bash
fly certs add field.batios.example --app batios-field-pwa
fly certs add admin.batios.example --app batios-admin
fly certs add pm.batios.example --app batios-pm-dashboard
fly certs add qs.batios.example --app batios-qs-dashboard
```

Then configure DNS using the instructions returned by Fly, and verify each
certificate:

```bash
fly certs check field.batios.example --app batios-field-pwa
```

Repeat for each hostname. Keep the `.fly.dev` URLs available for emergency
operator access until domain routing has been stable for at least one release.

## Smoke And Monitoring

Export production URLs and run the existing health smoke check:

```bash
export BATIOS_FIELD_PWA_URL="https://field.batios.example"
export BATIOS_ADMIN_URL="https://admin.batios.example"
export BATIOS_PM_DASHBOARD_URL="https://pm.batios.example"
export BATIOS_QS_DASHBOARD_URL="https://qs.batios.example"

corepack pnpm staging:smoke
```

Operators can also run the `Production Smoke` GitHub Actions workflow from the
Actions tab. Provide the four production URLs as manual inputs, or configure
these repository variables:

- `BATIOS_PRODUCTION_FIELD_PWA_URL`
- `BATIOS_PRODUCTION_ADMIN_URL`
- `BATIOS_PRODUCTION_PM_DASHBOARD_URL`
- `BATIOS_PRODUCTION_QS_DASHBOARD_URL`

The workflow is manual-only until production domains are live and alert
ownership is agreed. If URLs are missing, the smoke script fails before any
network requests and names the missing values.

Before cutover, configure alerts for:

- Any app `/healthz` endpoint returning non-2xx.
- Fly deploy failures.
- Machine restarts or crash loops.
- Database backup failure or missing scheduled backup.
- Database connection errors in app logs.
- Smoke-check regression after deployment.

Record the alert destination and on-call owner in the release notes.

## Rollback

Rollback restores the application image, not database state. If a deployment ran
data migrations, prepare the data rollback or forward-fix separately before
redeploying an older image.

Application rollback:

1. Find the previous good image with `fly releases --app <app-name>`.
2. Redeploy that image with `fly deploy --image <image-ref> --app <app-name>`.
3. Run `corepack pnpm staging:smoke` or the `Production Smoke` workflow against
   production URLs.
4. Check app logs and database connection health.
5. Record the rollback image, operator, reason, and result.

Database recovery:

1. Restore the verified backup into a new production database or cluster.
2. Attach one app to the restored database in a controlled window.
3. Run smoke checks and targeted data integrity checks.
4. Rotate `DATABASE_URL` for all production apps only after verification.

## Go/No-Go

Production is ready only when:

- PR #26 or its successor is merged into `main`.
- This checklist is complete for the target release.
- Production database backup and restore is verified.
- Production secrets are set and reviewed without exposing values.
- Custom domains and TLS checks pass.
- All four `/healthz` endpoints pass smoke checks.
- Rollback owner and commands are confirmed.
