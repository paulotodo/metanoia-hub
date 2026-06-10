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
import { RedisService } from '../redis/redis.service';

const IMMUTABLE_INIT_FIELDS = ['issuer', 'jwks', 'expectedAudience'] as const;

@Injectable()
export class KeycloakAuthGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(KeycloakAuthGuard.name);
  private jwks!: JWTVerifyGetKey;
  private issuer!: string;
  private expectedAudience!: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    const keycloakUrl = this.config.get('KEYCLOAK_URL', { infer: true });
    const realm = this.config.get('KEYCLOAK_REALM', { infer: true });
    this.issuer = `${keycloakUrl}/realms/${realm}`;
    this.expectedAudience = this.config.get('KEYCLOAK_EXPECTED_AUDIENCE', {
      infer: true,
    });

    const jwksUrl = new URL(`${this.issuer}/protocol/openid-connect/certs`);
    this.jwks = createRemoteJWKSet(jwksUrl);
    this.logger.log(
      `JWKS endpoint configured: ${jwksUrl.toString()} (audience: ${this.expectedAudience})`,
    );

    this.freezeInitState();
  }

  private freezeInitState(): void {
    for (const key of IMMUTABLE_INIT_FIELDS) {
      Object.defineProperty(this, key, {
        value: this[key],
        writable: false,
        configurable: false,
        enumerable: true,
      });
    }
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

    const activeTenantId = await this.resolveActiveTenant(
      userId,
      payload.tenant_id,
    );

    // Populate tenant context in AsyncLocalStorage (scoped by TenantContextMiddleware.run())
    const store = requestContext.getStore();
    if (store) {
      store.tenantId = activeTenantId;
      store.userId = userId;
    }

    const roles = Object.freeze([...(payload.realm_roles ?? [])]);
    const user: AuthenticatedUser = Object.freeze({
      userId,
      tenantId: activeTenantId,
      roles,
      email: payload.email,
    }) as AuthenticatedUser;

    request.user = user;
    return true;
  }

  private async resolveActiveTenant(
    userId: string | undefined,
    fallback: string,
  ): Promise<string> {
    if (!userId) return fallback;
    try {
      const override = await this.redis.get(`user:${userId}:active-tenant`);
      return override ?? fallback;
    } catch (error) {
      // Resilience policy (FR-005, FR-008):
      // When Redis is unavailable, the JWT `tenant_id` claim is used as the
      // authoritative fallback. This is safe because the JWT is
      // cryptographically signed and `tenant_id` always reflects the user's
      // primary (onboarding) tenant. The only data quality risk is a recently-
      // switched user reverting to their primary tenant for the duration of the
      // Redis outage — this is an accepted trade-off documented in
      // docs/specs/2-5-tenant-select-residual/data-model.md.
      // Logged at ERROR (not warn) so on-call operators are alerted promptly.
      this.logger.error(
        `Redis unavailable; falling back to JWT tenant for userId=${userId}: ${String(error)}`,
      );
      return fallback;
    }
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
        audience: this.expectedAudience,
      });
      return payload as unknown as KeycloakJwtPayload;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          throw new UnauthorizedException('Token has expired');
        }
        if (
          error.message.includes('audience') ||
          error.message.toLowerCase().includes('aud')
        ) {
          this.logger.warn(
            `JWT audience mismatch (expected '${this.expectedAudience}'): ${error.message}`,
          );
          throw new UnauthorizedException('Invalid authentication token');
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
