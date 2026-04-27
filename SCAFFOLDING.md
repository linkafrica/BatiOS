# BatiOS Repository: what is what

This repository contains three distinct classes of content. Do not confuse them. Each class has different authority and a different treatment by the incoming Tech Lead and engineering team.

## Class 1: Authoritative specification

**Status:** binding. Changes require the revision protocol documented in each artifact.

- `README.md`, `EXECUTION_PLAN.md`, `TECH_LEAD_HANDOVER.md`, `CLAUDE_CODE_BUILD_PLAN.md` — operational documents.
- `.claude/agents/*.md` — five build-time agent operating manuals.
- `adrs/ADR-00*.md` — nine Architectural Decision Records, all Accepted.
- `specs/ipc-autopilot/v3.md` plus `v3.md.countersigned.md` — the countersigned Module 1 specification. Builders reference the spec hash `9371ef34...797` in every PR.
- `specs/ipc-autopilot/v1.md`, `v1.review.md`, `v2.md`, `v2.review.md`, `v3.review.md` — audit trail of the spec revision cycle. Do not delete.
- `prompts/**/v*.yaml` and `prompts/schemas/*.json` — the two active Module 1 prompts and their strict output schemas. Revision protocol in `prompts/README.md`.

This content was produced through three rounds of Platform Architect review for Module 1 and adversarial review for the ADRs. It represents the binding contract between the Tech Lead and the build.

## Class 2: Scaffolding

**Status:** extend as needed. No binding design content. Any competent Tech Lead would produce equivalent scaffolding in the first day of Week 0.

Monorepo structure:

- Root tooling configs: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`, `.gitignore`, `.editorconfig`, `.nvmrc`, `.env.example`.
- Eight package skeletons under `packages/` with `package.json`, `tsconfig.json`, a one-line `src/index.ts` stub, and in four cases a README documenting the package's boundary: `platform-core`, `ipc-autopilot`, `agent-gateway`, `events-core`, `schemas`, `qa-harness`, `design-system`, `api-client`.
- Four app skeletons under `apps/` with `package.json`, `tsconfig.json`, `next.config.mjs`, a minimal layout and landing page: `field-pwa`, `qs-dashboard`, `pm-dashboard`, `admin`.
- Tenancy migration scaffold under `packages/platform-core/src/migrations/`.
- CI workflows at `.github/workflows/ci.yml` (lint, typecheck, test, integration, compliance) and `.github/workflows/qa-agent.yml` (QA Agent review on PRs).
- Compliance Mapper stub at `compliance-mapper-stub.mjs`. Catches direct LLM SDK imports outside the Agent Gateway, direct writes to `artifact_events` outside `events-core`, browser storage use, and migration files that appear tenant-scoped but lack a complete RLS block. Crude regex scanner. A real Compliance Mapper agent with its own operating manual replaces it later.

Scaffolding design choices worth the Tech Lead's attention:

- **pnpm workspaces** over npm/yarn/bun: best multi-package TypeScript build performance, strict dependency hoisting, predictable lockfile behaviour.
- **TypeScript project references** everywhere: enables `tsc -b` for incremental builds across the monorepo and makes circular dependencies visible at compile time.
- **ESLint flat config** enforcing only rules it can reliably catch without custom plugins: no LLM SDK imports outside `packages/agent-gateway`, no `console.log` in production code, and no eval-style execution. The compliance mapper and QA Agent catch broader semantic violations.
- **Vitest** over Jest: faster, ESM-native, works with TypeScript project references without transformer hacks.
- **Kysely** over Prisma or TypeORM: type-safe SQL builder that composes cleanly with raw RLS policies and append-only triggers. Prisma's migration layer abstracts in ways that fight ADR-0002.
- **Hono** over Express or Fastify: runs on Cloudflare Workers (our edge target per ADR-0001) and Node equally well; TypeScript-first.
- **Next.js 15 with App Router** for all apps: aligns with the Field PWA offline-first model and gives server components where useful.
- **React 19** (latest stable at time of writing). Verify compatibility with your chosen shadcn/ui version before committing.

If the Tech Lead has strong opinions on any of these choices, override before Week 0 Day 3 (when framework-agreements start being signed with suppliers). After that, changes are expensive.

## Class 3: Illustrative

**Status:** example only. Never deployed. Never depended on.

Located at `scratch/`. Specifically:

- `scratch/illustrative-sessions/session-1-2-B1-tenancy-foundations/` — a simulated Backend Builder session output showing what the Tech Lead should expect when the real team runs Session 1.2.B1 from the build plan.

Illustrative content exists to calibrate expectations. It was produced by the same system that wrote the specifications, in the same conversation, without real infrastructure, without a real QA Agent context separation, without real Postgres to run RLS tests against, without a human supervisor at session boundaries.

It looks plausible. It may be close to correct. But it is not production and never will be. Real implementation happens when a real Tech Lead runs a real Claude Code session against real infrastructure with a real human watching output per the build plan's supervision discipline.

Do not copy illustrative code into production packages. Do not merge PRs that claim to "use the scratch example." Do not let team members reference illustrative content as authoritative. If a scratch file looks useful, treat it as a starting point that a real session reproduces with supervision, not as code to lift.

## How to onboard with this structure

1. Read Class 1 in the order the Tech Lead Handover specifies. Priority reading, 4-5 hours.
2. Inspect Class 2. Decide whether to override any scaffolding choice. Record decisions in your v2 of `TECH_LEAD_HANDOVER.md`.
3. Skim Class 3 to calibrate expectations of what real Backend Builder output will look like. Do not treat it as code.
4. Hire engineers. Provision infrastructure. Run the first real Claude Code session per `CLAUDE_CODE_BUILD_PLAN.md` Section 3.

## Checksum on authority

When in doubt about whether a file is authoritative or scaffolding or illustrative, check:

- Files referenced by the Tech Lead Handover as required reading → Class 1.
- Files under `scratch/` → Class 3.
- Everything else at repo root or under `packages/` and `apps/` → Class 2.

If a file straddles categories, the Tech Lead decides at the earliest PR review and the decision is logged in that PR.
