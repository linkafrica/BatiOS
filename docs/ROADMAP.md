# BatiOS Roadmap

This roadmap mirrors the first GitHub Issues that should be created once GitHub
CLI authentication is available.

## Week 0 Repository Readiness

- [x] Add buildable pnpm monorepo scaffold.
- [x] Add setup and command documentation.
- [x] Move tenancy migration scaffold into `packages/platform-core`.
- [ ] Enable branch protection for `main`.
- [ ] Confirm GitHub Actions status checks are required on pull requests.

## First Implementation Issues

### Platform Core tenancy foundations

Wire `packages/platform-core/src/migrations/0001-tenancy-foundations.ts` into a
real migration runner and add PostgreSQL-backed RLS tests for organisation,
project, party, and role access rules.

Acceptance:

- Migration runner can apply the tenancy foundation migration.
- RLS tests cover owner read/write and joint-custody read paths.
- No down migration path is exposed.

### Events Core append-only artifact events

Define the append-only event API inside `packages/events-core` and keep all
direct writes to `artifact_events` behind that package boundary.

Acceptance:

- Event append API is typed.
- Direct writes outside `events-core` are blocked by compliance scan.
- Tests cover append-only behavior.

### Agent Gateway boundary

Create the first `packages/agent-gateway` service interface so all LLM provider
calls are routed through a single audited boundary.

Acceptance:

- No app or package imports LLM SDKs directly.
- Gateway interface captures request metadata needed for audit.
- Compliance scan remains clean.

### IPC Autopilot module shell

Turn `packages/ipc-autopilot` from a boundary stub into the first orchestrator
module for IPC assessment workflows.

Acceptance:

- Public module API is typed.
- Module does not call LLM SDKs directly.
- Unit tests cover the orchestration entrypoint.

### Field PWA shell

Replace the placeholder `apps/field-pwa` page with the first field evidence
capture workflow shell.

Acceptance:

- Route renders a usable first workflow screen.
- No browser storage APIs are used.
- Build, lint, and typecheck pass.

### Dashboard shells

Replace placeholder pages for QS, PM, and Admin dashboards with useful first
screens for repeated operational work.

Acceptance:

- Each dashboard has a clear first screen.
- Shared UI decisions are routed through `packages/design-system`.
- Build, lint, and typecheck pass.

### QA and compliance harness

Expand `packages/qa-harness` and `compliance-mapper-stub.mjs` into a stronger
pre-PR verification path.

Acceptance:

- `corepack pnpm run compliance:scan` catches current architecture violations.
- `corepack pnpm run qa:harness` has a concrete entrypoint.
- CI runs lint, typecheck, tests, and compliance scan.
