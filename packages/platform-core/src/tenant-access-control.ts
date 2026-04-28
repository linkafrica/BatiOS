export type PrincipalStatus = 'active' | 'suspended';

export type OrganisationRole = 'owner' | 'admin' | 'member' | 'auditor';

export type ProjectPartyRole = 'Owner' | 'Contractor' | 'PM' | 'Employer' | 'External';

export type ProjectCustodyLevel = 'read' | 'comment' | 'approve' | 'admin';

export type ProjectRole =
  | 'ProjectAdmin'
  | 'CommercialManager'
  | 'QuantitySurveyor'
  | 'FieldAgent'
  | 'Approver'
  | 'Viewer';

export type TenantPermission =
  | 'tenant:read'
  | 'tenant:manage-users'
  | 'project:read'
  | 'project:comment'
  | 'project:approve-ipc'
  | 'project:manage-access';

export interface AuthenticatedPrincipal {
  userId: string;
  organisationId: string;
  status: PrincipalStatus;
  organisationRoles: readonly OrganisationRole[];
  email?: string;
}

export interface ProjectPartyGrant {
  projectId: string;
  organisationId: string;
  partyRole: ProjectPartyRole;
  custodyLevel: ProjectCustodyLevel;
  revokedAt?: Date;
}

export interface ProjectRoleGrant {
  userId: string;
  projectId: string;
  organisationId: string;
  role: ProjectRole;
  revokedAt?: Date;
}

export interface TenantResourceScope {
  organisationId: string;
  projectId?: string;
}

export interface TenantAccessContext {
  principal: AuthenticatedPrincipal;
  projectParties?: readonly ProjectPartyGrant[];
  projectRoles?: readonly ProjectRoleGrant[];
}

export interface TenantAccessDecision {
  allowed: boolean;
  reason?: string;
}

export interface TenantAccessPolicy {
  can(permission: TenantPermission, scope: TenantResourceScope): TenantAccessDecision;
  assertCan(permission: TenantPermission, scope: TenantResourceScope): void;
}

const custodyRank: Readonly<Record<ProjectCustodyLevel, number>> = {
  read: 1,
  comment: 2,
  approve: 3,
  admin: 4,
};

const projectRolePermissions: Readonly<Record<ProjectRole, readonly TenantPermission[]>> = {
  ProjectAdmin: ['project:read', 'project:comment', 'project:approve-ipc', 'project:manage-access'],
  CommercialManager: ['project:read', 'project:comment', 'project:approve-ipc'],
  QuantitySurveyor: ['project:read', 'project:comment', 'project:approve-ipc'],
  FieldAgent: ['project:read', 'project:comment'],
  Approver: ['project:read', 'project:comment', 'project:approve-ipc'],
  Viewer: ['project:read'],
};

export function createTenantAccessPolicy(context: TenantAccessContext): TenantAccessPolicy {
  assertPrincipalHasOrganisationContext(context.principal);

  return {
    can(permission, scope) {
      return evaluateTenantAccess(context, permission, scope);
    },
    assertCan(permission, scope) {
      const decision = evaluateTenantAccess(context, permission, scope);

      if (!decision.allowed) {
        throw new Error(decision.reason ?? 'tenant access denied');
      }
    },
  };
}

export function evaluateTenantAccess(
  context: TenantAccessContext,
  permission: TenantPermission,
  scope: TenantResourceScope,
): TenantAccessDecision {
  const principal = context.principal;
  assertPrincipalHasOrganisationContext(principal);
  assertScopeHasOrganisationContext(scope);

  if (principal.status !== 'active') {
    return deny('principal is not active');
  }

  if (principal.organisationId !== scope.organisationId) {
    return deny('cross-tenant access is denied');
  }

  if (permission === 'tenant:read') {
    return allow();
  }

  if (permission === 'tenant:manage-users') {
    return hasAnyOrganisationRole(principal, ['owner', 'admin'])
      ? allow()
      : deny('principal cannot manage tenant users');
  }

  if (scope.projectId === undefined || scope.projectId.trim().length === 0) {
    return deny('project scope is required');
  }

  const projectScope = {
    organisationId: scope.organisationId,
    projectId: scope.projectId,
  };
  const projectParty = findActiveProjectParty(context, projectScope);

  if (projectParty === undefined) {
    return deny('active project custody is required');
  }

  const role = findActiveProjectRole(context, projectScope);

  if (role === undefined) {
    return deny('active project role is required');
  }

  if (!projectRolePermissions[role.role].includes(permission)) {
    return deny(`project role ${role.role} cannot ${permission}`);
  }

  if (!custodyAllows(projectParty.custodyLevel, requiredCustodyFor(permission))) {
    return deny(`project custody ${projectParty.custodyLevel} cannot ${permission}`);
  }

  return allow();
}

function findActiveProjectParty(
  context: TenantAccessContext,
  scope: Required<TenantResourceScope>,
): ProjectPartyGrant | undefined {
  return context.projectParties?.find(
    (party) =>
      party.projectId === scope.projectId &&
      party.organisationId === scope.organisationId &&
      party.revokedAt === undefined,
  );
}

function findActiveProjectRole(
  context: TenantAccessContext,
  scope: Required<TenantResourceScope>,
): ProjectRoleGrant | undefined {
  return context.projectRoles?.find(
    (role) =>
      role.userId === context.principal.userId &&
      role.projectId === scope.projectId &&
      role.organisationId === scope.organisationId &&
      role.revokedAt === undefined,
  );
}

function requiredCustodyFor(permission: TenantPermission): ProjectCustodyLevel {
  switch (permission) {
    case 'project:manage-access':
      return 'admin';
    case 'project:approve-ipc':
      return 'approve';
    case 'project:comment':
      return 'comment';
    case 'project:read':
    case 'tenant:read':
    case 'tenant:manage-users':
      return 'read';
  }
}

function custodyAllows(actual: ProjectCustodyLevel, required: ProjectCustodyLevel): boolean {
  return custodyRank[actual] >= custodyRank[required];
}

function hasAnyOrganisationRole(
  principal: AuthenticatedPrincipal,
  roles: readonly OrganisationRole[],
): boolean {
  return principal.organisationRoles.some((role) => roles.includes(role));
}

function assertPrincipalHasOrganisationContext(principal: AuthenticatedPrincipal): void {
  assertNonEmpty(principal.userId, 'principal.userId');
  assertNonEmpty(principal.organisationId, 'principal.organisationId');

  if (principal.organisationRoles.length === 0) {
    throw new Error('principal.organisationRoles must contain at least one role');
  }
}

function assertScopeHasOrganisationContext(scope: TenantResourceScope): void {
  assertNonEmpty(scope.organisationId, 'scope.organisationId');
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function allow(): TenantAccessDecision {
  return { allowed: true };
}

function deny(reason: string): TenantAccessDecision {
  return { allowed: false, reason };
}
