import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { LoginInput, LoginResponse } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import { SessionService } from './session.service';

interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly sessionService: SessionService,
  ) {}

  async login(input: LoginInput, metadata: RequestMetadata): Promise<LoginResponse> {
    const { email, password } = input;

    // 1. Authenticate via Keycloak token endpoint (ROPC grant)
    const tokens = await this.keycloakAdmin.authenticateUser(email, password);

    if (!tokens) {
      this.logger.warn({ email, action: 'auth.login.failed', ip: metadata.ipAddress }, 'invalid credentials');
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Email ou senha incorretos',
      });
    }

    // 2. Look up user in PostgreSQL with tenants and consent data
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: {
        userTenants: true,
        consents: {
          where: { documentType: 'terms_of_service' },
          take: 1,
        },
      },
    });

    if (!user) {
      // User exists in Keycloak but not in DB — should not happen in normal flow
      this.logger.error({ email, action: 'auth.login.failed' }, 'user authenticated in keycloak but not found in database');
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Email ou senha incorretos',
      });
    }

    // 3. Create session in Redis
    const sessionId = await this.sessionService.create(user.id, tokens.expiresIn, metadata);

    this.logger.log({ userId: user.id, email, action: 'auth.login.success' }, 'user logged in');

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hasConsent: user.consents.length > 0,
        tenants: user.userTenants.map((ut) => ({
          id: ut.tenantId,
          name: ut.tenantId, // Tenant name will be resolved when Tenant model exists
          role: ut.role,
        })),
      },
    };
  }
}
