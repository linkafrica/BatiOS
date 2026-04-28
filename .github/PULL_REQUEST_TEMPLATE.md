## Summary

-

## Verification

- [ ] `corepack pnpm build`
- [ ] `corepack pnpm e2e:workflow`
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm typecheck`
- [ ] `corepack pnpm test`
- [ ] `corepack pnpm format:check`
- [ ] `corepack pnpm qa:harness`
- [ ] `corepack pnpm compliance:scan`

## Production Impact

- [ ] No direct LLM SDK imports outside `packages/agent-gateway`
- [ ] No direct artifact event writes outside `packages/events-core`
- [ ] Tenant-scoped changes preserve organisation/project access controls
- [ ] Runtime secrets are documented without committing real values
