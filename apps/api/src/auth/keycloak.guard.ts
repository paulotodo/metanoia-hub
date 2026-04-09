import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { requestContext } from '../common/context/request-context';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { KeycloakJwtPayload } from './interfaces/jwt-payload.interface';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import type { EnvConfig } from '../config/env.validation';

@Injectable()
export class KeycloakAuthGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(KeycloakAuthGuard.name);
  private jwks!: JWTVerifyGetKey;
  private issuer!: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  onModuleInit(): void {
    const keycloakUrl = this.config.get('KEYCLOAK_URL', { infer: true });
    const realm = this.config.get('KEYCLOAK_REALM', { infer: true });
    this.issuer = `${keycloakUrl}/realms/${realm}`;

    const jwksUrl = new URL(`${this.issuer}/protocol/openid-connect/certs`);
    this.jwks = createRemoteJWKSet(jwksUrl);
    this.logger.log(`JWKS endpoint configured: ${jwksUrl.toString()}`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const payload = await this.verifyToken(token);

    if (!payload.tenant_id) {
      throw new UnauthorizedException('Missing tenant_id claim in token');
    }

    const userId = payload.user_id ?? payload.sub;
    if (!payload.user_id) {
      this.logger.warn('user_id claim missing from token, falling back to sub');
    }

    // Populate tenant context in AsyncLocalStorage (scoped by TenantContextMiddleware.run())
    const store = requestContext.getStore();
    if (store) {
      store.tenantId = payload.tenant_id;
      store.userId = userId;
    }

    const user: AuthenticatedUser = {
      userId,
      tenantId: payload.tenant_id,
      roles: payload.realm_roles ?? [],
      email: payload.email,
    };

    request.user = user;
    return true;
  }

  private extractToken(request: {
    headers: { authorization?: string };
    query?: { token?: string };
  }): string | null {
    // 1. Prefer Authorization header (standard flow)
    const authorization = request.headers.authorization;
    if (authorization) {
      const [type, token] = authorization.split(' ');
      return type === 'Bearer' && token ? token : null;
    }

    // 2. Fallback to query param (SSE/EventSource — cannot set headers)
    return request.query?.token ?? null;
  }

  private async verifyToken(token: string): Promise<KeycloakJwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });
      return payload as unknown as KeycloakJwtPayload;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          throw new UnauthorizedException('Token has expired');
        }
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
          this.logger.error(`JWKS endpoint unreachable: ${error.message}`);
          throw new UnauthorizedException('Authentication service unavailable');
        }
      }
      throw new UnauthorizedException('Invalid authentication token');
    }
  }
}
