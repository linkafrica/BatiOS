# BatiOS

BatiOS is a contract-native evidence, orchestration, and payment platform for
African public works. This repository is the first build scaffold: a pnpm
TypeScript monorepo with package boundaries, app shells, compliance scanning,
and CI placeholders ready for the first implementation slices.

## Status

This is foundation scaffolding. The workspace builds, lints, typechecks, formats,
and runs the compliance scanner, but most packages are still boundary stubs.

The tenancy migration in `packages/platform-core/src/migrations/` is illustrative
until it is wired to a real migration runner and tested against PostgreSQL RLS.

## Requirements

- Node.js 20.18 or newer
- Corepack
- pnpm 9.12, managed through Corepack

## Setup

```bash
corepack enable
corepack pnpm install
```

## Common Commands

```bash
corepack pnpm run build
corepack pnpm run lint
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run format:check
corepack pnpm run compliance:scan
```

## Workspace Layout

- `apps/field-pwa` - field evidence capture shell
- `apps/qs-dashboard` - quantity surveying dashboard shell
- `apps/pm-dashboard` - project management dashboard shell
- `apps/admin` - administration shell
- `packages/platform-core` - tenancy, persistence, and platform runtime boundary
- `packages/ipc-autopilot` - IPC assessment orchestration boundary
- `packages/agent-gateway` - only boundary for external LLM SDK access
- `packages/events-core` - append-only artifact event boundary
- `packages/schemas` - shared schema contracts
- `packages/qa-harness` - QA harness entrypoint
- `packages/design-system` - shared UI primitives boundary
- `packages/api-client` - typed client boundary

## Development Notes

- Keep direct LLM SDK imports inside `packages/agent-gateway`.
- Keep direct artifact event writes inside `packages/events-core`.
- Do not use browser storage APIs for runtime state.
- Run `corepack pnpm run compliance:scan` before opening a PR.
- Future work should land through pull requests once branch protection is enabled.
