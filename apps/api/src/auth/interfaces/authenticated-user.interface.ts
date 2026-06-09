import type { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  /**
   * Array of roles from the Keycloak realm_roles claim.
   * Typed as (Role | string)[] for backward compatibility with legacy
   * callsites that use 'pastor' / 'admin' string literals (Epic 11).
   */
  roles: (Role | string)[];
  email: string;
}
