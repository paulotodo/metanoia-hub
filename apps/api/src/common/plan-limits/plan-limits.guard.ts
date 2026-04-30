import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRequestContext } from '../context/request-context';
import { PLAN_LIMIT_META } from './plan-limit.decorator';
import type { PlanLimitedResource } from './plan-limits.config';
import { PlanLimitsService } from './plan-limits.service';

/**
 * NestJS guard that rejects writes when the tenant has reached its plan cap
 * for a given resource. Routes opt in via `@PlanLimit('groups')` etc.
 *
 * Place this guard AFTER KeycloakAuthGuard (request.user must be set) and
 * AFTER the request-context middleware (tenantId available via
 * AsyncLocalStorage).
 */
@Injectable()
export class PlanLimitsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: PlanLimitsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<
      PlanLimitedResource | undefined
    >(PLAN_LIMIT_META, [context.getHandler(), context.getClass()]);

    if (!resource) return true;

    const { tenantId } = getRequestContext();
    if (!tenantId) {
      // No tenant context = not authenticated for tenant work; let other
      // guards / context middleware reject earlier.
      return true;
    }

    const { allowed, current, limit, plan } = await this.service.hasCapacity(
      tenantId,
      resource,
    );

    if (!allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'PlanLimitReached',
        message: `Plan ${plan} allows up to ${limit} ${resource}; current count: ${current}.`,
        details: { resource, plan, current, limit },
      });
    }

    return true;
  }
}
