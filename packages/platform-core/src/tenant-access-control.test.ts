import { describe, expect, it } from 'vitest';

import {
  createTenantAccessPolicy,
  evaluateTenantAccess,
  type AuthenticatedPrincipal,
  type ProjectPartyGrant,
  type ProjectRoleGrant,
  type TenantAccessContext,
} from './tenant-access-control.js';

const principal: AuthenticatedPrincipal = {
  userId: '44444444-4444-4444-8444-444444444444',
  organisationId: '33333333-3333-4333-8333-333333333333',
  status: 'active',
  organisationRoles: ['member'],
  email: 'qs@example.test',
};

const projectParty: ProjectPartyGrant = {
  projectId: '22222222-2222-4222-8222-222222222222',
  organisationId: principal.organisationId,
  partyRole: 'PM',
  custodyLevel: 'approve',
};

const projectRole: ProjectRoleGrant = {
  userId: principal.userId,
  projectId: projectParty.projectId,
  organisationId: principal.organisationId,
  role: 'QuantitySurveyor',
};

function context(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    principal,
    projectParties: [projectParty],
    projectRoles: [projectRole],
    ...overrides,
  };
}

describe('tenant access control', () => {
  it('allows active project users when role and custody both grant the permission', () => {
    const policy = createTenantAccessPolicy(context());

    expect(
      policy.can('project:approve-ipc', {
        organisationId: principal.organisationId,
        projectId: projectParty.projectId,
      }),
    ).toEqual({ allowed: true });
  });

  it('denies cross-tenant access before evaluating project grants', () => {
    expect(
      evaluateTenantAccess(context(), 'project:read', {
        organisationId: '99999999-9999-4999-8999-999999999999',
        projectId: projectParty.projectId,
      }),
    ).toEqual({
      allowed: false,
      reason: 'cross-tenant access is denied',
    });
  });

  it('denies revoked project custody grants', () => {
    expect(
      evaluateTenantAccess(
        context({
          projectParties: [
            {
              ...projectParty,
              revokedAt: new Date('2026-04-27T13:00:00.000Z'),
            },
          ],
        }),
        'project:read',
        {
          organisationId: principal.organisationId,
          projectId: projectParty.projectId,
        },
      ),
    ).toEqual({
      allowed: false,
      reason: 'active project custody is required',
    });
  });

  it('denies project permissions when custody is too low', () => {
    expect(
      evaluateTenantAccess(
        context({
          projectParties: [
            {
              ...projectParty,
              custodyLevel: 'read',
            },
          ],
        }),
        'project:approve-ipc',
        {
          organisationId: principal.organisationId,
          projectId: projectParty.projectId,
        },
      ),
    ).toEqual({
      allowed: false,
      reason: 'project custody read cannot project:approve-ipc',
    });
  });

  it('requires organisation context on principals and scopes', () => {
    expect(() =>
      createTenantAccessPolicy(
        context({
          principal: {
            ...principal,
            organisationId: '',
          },
        }),
      ),
    ).toThrow('principal.organisationId is required');

    expect(() =>
      evaluateTenantAccess(context(), 'tenant:read', {
        organisationId: '',
      }),
    ).toThrow('scope.organisationId is required');
  });

  it('allows tenant user administration only for tenant owners and admins', () => {
    expect(
      evaluateTenantAccess(context(), 'tenant:manage-users', {
        organisationId: principal.organisationId,
      }),
    ).toEqual({
      allowed: false,
      reason: 'principal cannot manage tenant users',
    });

    expect(
      evaluateTenantAccess(
        context({
          principal: {
            ...principal,
            organisationRoles: ['admin'],
          },
        }),
        'tenant:manage-users',
        {
          organisationId: principal.organisationId,
        },
      ),
    ).toEqual({ allowed: true });
  });
});
