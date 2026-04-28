# Release Checklist

Use this checklist before treating a commit on `main` as release-ready.

## Required Gates

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm e2e:workflow
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm format:check
corepack pnpm qa:harness
corepack pnpm compliance:scan
```

## Staging Validation

1. Deploy from a clean checkout of `main`.
2. Set the environment described in `docs/STAGING.md`.
3. Run `corepack pnpm staging:smoke` against deployed staging URLs.
4. Confirm Field PWA, Admin, PM, and QS surfaces return healthy status codes.

## Review Requirements

- Pull request links to the tracked issue.
- CI checks `qa` and `qa-agent` pass.
- Architecture-sensitive changes call out tenant access, audit, custody, or
  provider-boundary impact.
- No real secrets, credentials, or production data are committed.

## Current Enforcement Gap

GitHub branch protection for `main` is tracked in issue #21. Until that is
available, this checklist and the pull request template are the source of truth
for release discipline.
