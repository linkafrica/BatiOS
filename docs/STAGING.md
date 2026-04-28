# Staging Deployment Contract

This contract defines the first reproducible staging target for BatiOS. Staging
must run from a clean checkout of `main`, use only values supplied through the
deployment provider secret store, and pass smoke checks before it is treated as
ready for end-to-end testing.

## Required Runtime

- Node.js 20.18.x
- Corepack enabled
- pnpm 9.12.0
- PostgreSQL 16.x

## Required Secrets And Environment

Real values belong in the deployment provider secret store. The repository only
keeps placeholders in `.env.staging.example`.

| Name                            | Owner    | Required | Purpose                                            |
| ------------------------------- | -------- | -------- | -------------------------------------------------- |
| `BATIOS_ENVIRONMENT`            | Platform | Yes      | Must be `staging` for staging deployments.         |
| `DATABASE_URL`                  | Platform | Yes      | PostgreSQL 16 connection string for staging data.  |
| `BATIOS_ORGANISATION_ID`        | Platform | Yes      | Default organisation context for smoke fixtures.   |
| `BATIOS_SESSION_SECRET`         | Platform | Yes      | Session/signing secret; minimum 32 random bytes.   |
| `BATIOS_FIELD_PWA_URL`          | Frontend | Yes      | Public Field PWA staging URL.                      |
| `BATIOS_ADMIN_URL`              | Frontend | Yes      | Public Admin staging URL.                          |
| `BATIOS_PM_DASHBOARD_URL`       | Frontend | Yes      | Public PM dashboard staging URL.                   |
| `BATIOS_QS_DASHBOARD_URL`       | Frontend | Yes      | Public QS dashboard staging URL.                   |
| `BATIOS_AGENT_GATEWAY_PROVIDER` | Platform | Optional | Provider routed through `packages/agent-gateway`.  |
| `BATIOS_AGENT_GATEWAY_MODEL`    | Platform | Optional | Model identifier for IPC Autopilot staging checks. |

## Clean Checkout Build

Run these commands from a fresh checkout:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm format:check
corepack pnpm qa:harness
corepack pnpm compliance:scan
```

## Staging Smoke Check

Fly.io deployment steps live in `docs/FLY.md`.

After deployment, export the four public app URLs and run:

```bash
corepack pnpm staging:smoke
```

The smoke check performs an HTTP `GET` against each app's `/healthz` endpoint:

- Field PWA
- Admin dashboard
- PM dashboard
- QS dashboard

Each endpoint must return a 2xx or 3xx status and a JSON payload with the
expected service name, `status: "ok"`, and a valid `checkedAt` timestamp. The
script does not require or print secret values.

## Automated Smoke Monitor

The `Staging Smoke` GitHub Actions workflow runs `corepack pnpm staging:smoke`
on a schedule and can also be started manually from the Actions tab.

By default, the workflow checks the Fly staging URLs:

- `https://batios-field-pwa-staging.fly.dev`
- `https://batios-admin-staging.fly.dev`
- `https://batios-pm-dashboard-staging.fly.dev`
- `https://batios-qs-dashboard-staging.fly.dev`

Operators can override those defaults with repository variables:

- `BATIOS_FIELD_PWA_URL`
- `BATIOS_ADMIN_URL`
- `BATIOS_PM_DASHBOARD_URL`
- `BATIOS_QS_DASHBOARD_URL`

Manual runs can also override the four URLs with workflow inputs. A failed run
means at least one `/healthz` endpoint is unreachable, returned a non-2xx/3xx
status, or returned an invalid health payload. Check the failed job log, inspect
the affected Fly app logs, and rerun the workflow after recovery.

## Readiness Criteria

Staging is ready for E2E work when:

- The clean checkout build passes.
- All required environment variables are set in the deployment provider.
- `corepack pnpm staging:smoke` passes against deployed app URLs.
- No real secret values are committed to the repository.
