import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../enums/role.enum';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { requestContext } from '../../common/context/request-context';

/**
 * Layer 3 guard — enforces tenant isolation per request.
 *
 * Execution order: KeycloakAuthGuard (JWT) → RolesGuard (roles) → TenantGuard (tenant)
 *
 * Fail-closed policy (FR-01, OWASP A01):
 * - If RequestContext is unavailable (middleware misconfiguration), reject with 403.
 * - If request.user is absent, reject with 403.
 * - super_admin bypasses the tenant check.
 * - tenant UUIDs are NEVER logged to prevent cross-tenant UUID discovery (IDOR, API1 BOLA).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Bypass for @Public() endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      method?: string;
      url?: string;
    }>();

    const user = request.user;
    const endpoint = `${request.method ?? 'UNKNOWN'} ${request.url ?? 'unknown'}`;
    const userId = user?.userId || 'unknown';

    // Fail-closed: user must be set (KeycloakAuthGuard should have populated it)
    if (!user) {
      this.logger.warn({
        action: 'auth.access.denied',
        user_id: 'unknown',
        endpoint,
        tenant_mismatch: true,
      });
      throw new ForbiddenException('Tenant access denied');
    }

    // super_admin bypasses tenant isolation
    if (user.roles.includes(Role.SUPER_ADMIN)) {
      return true;
    }

    // Fail-closed: RequestContext MUST be available.
    // Missing context = middleware misconfiguration = security failure.
    const store = requestContext.getStore();
    if (!store) {
      this.logger.warn({
        action: 'auth.access.denied',
        user_id: userId,
        endpoint,
        tenant_mismatch: true,
      });
      throw new ForbiddenException('Tenant access denied');
    }

    // Tenant isolation check: user.tenantId must match the resource tenant
    if (user.tenantId !== store.tenantId) {
      this.logger.warn({
        action: 'auth.access.denied',
        user_id: userId,
        endpoint,
        // SECURITY: boolean only — never log tenant UUIDs (IDOR via log leakage, API1 BOLA)
        tenant_mismatch: true,
      });
      throw new ForbiddenException('Tenant access denied');
    }

    return true;
  }
}
