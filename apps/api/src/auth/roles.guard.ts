import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators/roles.decorator';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { Role } from './enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(Role | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

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

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // super_admin bypasses all role restrictions (platform operator)
    if (user.roles.includes(Role.SUPER_ADMIN)) {
      return true;
    }

    if (!requiredRoles.some((role) => user.roles.includes(role))) {
      const userId = user.userId || 'unknown';
      const endpoint = `${request.method ?? 'UNKNOWN'} ${request.url ?? 'unknown'}`;

      this.logger.warn({
        action: 'auth.access.denied',
        user_id: userId,
        endpoint,
        required_role: requiredRoles,
        actual_roles: user.roles,
      });

      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
