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

After deployment, export the four public app URLs and run:

```bash
corepack pnpm staging:smoke
```

The smoke check performs an HTTP `GET` against:

- Field PWA
- Admin dashboard
- PM dashboard
- QS dashboard

Each endpoint must return a 2xx or 3xx status. The script does not require or
print secret values.

## Readiness Criteria

Staging is ready for E2E work when:

- The clean checkout build passes.
- All required environment variables are set in the deployment provider.
- `corepack pnpm staging:smoke` passes against deployed app URLs.
- No real secret values are committed to the repository.
