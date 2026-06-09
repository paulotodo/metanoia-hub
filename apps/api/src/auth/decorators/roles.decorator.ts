import { SetMetadata } from '@nestjs/common';
import type { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Decorator to declare which roles are required to access a route.
 *
 * Accepts canonical Role enum values and legacy string literals
 * (backward compatibility for 'pastor'/'admin' until Epic 11).
 *
 * @example
 *   @Roles(Role.ADMIN_TENANT)
 *   @Roles(Role.SUPER_ADMIN, Role.ADMIN_TENANT)
 */
export const Roles = (...roles: (Role | string)[]) =>
  SetMetadata(ROLES_KEY, roles);
