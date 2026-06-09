/**
 * Canonical Role enum for the Metanoia Hub platform.
 *
 * Values match Keycloak `realm_roles` claim strings exactly (case-sensitive).
 * All four values must remain in sync with the Keycloak realm configuration.
 *
 * Usage:
 *   @Roles(Role.ADMIN_TENANT)
 *   @Roles(Role.SUPER_ADMIN, Role.ADMIN_TENANT)
 *
 * Backward compatibility: the @Roles() decorator accepts `Role | string` to
 * support legacy callsites that use 'pastor' / 'admin' strings until those
 * roles are canonicalized in Epic 11.
 */
export enum Role {
  /** Platform operator — bypasses tenant checks; accesses all tenants */
  SUPER_ADMIN = 'super_admin',

  /** Church admin — scoped to their single tenant */
  ADMIN_TENANT = 'admin_tenant',

  /** Group leader — scoped to their tenant and assigned groups */
  LIDER = 'lider',

  /** Church member — access to own data and group content */
  PARTICIPANTE = 'participante',
}
