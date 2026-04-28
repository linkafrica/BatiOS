# End-to-End Workflow Coverage

The first E2E suite is intentionally deterministic and CI-runnable. It checks
the production-critical workflow without requiring hosted staging services:

1. Field evidence capture exposes the evidence record and review queue.
2. PM and QS dashboards expose review/readiness workspaces for the submitted
   evidence packet.
3. IPC Autopilot sends an assessment request through Agent Gateway.
4. Agent Gateway emits accepted and completed audit events with trace and usage
   diagnostics.
5. Admin exposes audit/compliance visibility for operational review.

Run it after build artifacts exist:

```bash
corepack pnpm build
corepack pnpm e2e:workflow
```

CI runs `pnpm e2e:workflow` immediately after `pnpm -r build`, so failures point
at either missing app workflow signals, broken package imports, a lost Agent
Gateway boundary, or missing audit diagnostics.

## Hosted Staging Follow-Up

When staging URLs are available, pair this suite with:

```bash
corepack pnpm staging:smoke
```

The smoke check validates that Field PWA, Admin, PM, and QS deployments are
reachable. A future browser automation suite should use the same workflow
signals documented here and run against those staging URLs.
