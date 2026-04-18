import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { LoginResponse, ResetPasswordInput } from '@metanoia/types';
import type { EnvConfig } from '../config/env.validation';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import { SessionService } from './session.service';
import { RecoveryEmailProducer } from './recovery-email.producer';

const TOKEN_TTL = 900; // 15 minutes
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_TTL = 3600; // 1 hour
const TIMING_SAFE_MIN_MS = 200;
const TIMING_SAFE_MAX_MS = 500;

interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '***';
  const domainParts = domain.split('.');
  const maskedDomain = domainParts[0][0] + '***.' + domainParts.slice(1).join('.');
  return `${maskedLocal}@${maskedDomain}`;
}

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly sessionService: SessionService,
    private readonly recoveryEmailProducer: RecoveryEmailProducer,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async requestRecovery(email: string): Promise<void> {
    const rateLimitKey = `rate:recovery:${email}`;
    const count = await this.redis.incr(rateLimitKey);
    if (count === 1) {
      await this.redis.expire(rateLimitKey, RATE_LIMIT_TTL);
    }

    if (count > RATE_LIMIT_MAX) {
      this.logger.warn({ email }, 'recovery rate limit exceeded');
      return;
    }

    const keycloakUser = await this.keycloakAdmin.findUserByEmail(email);

    if (!keycloakUser) {
      const delay =
        TIMING_SAFE_MIN_MS +
        Math.random() * (TIMING_SAFE_MAX_MS - TIMING_SAFE_MIN_MS);
      await sleep(delay);
      return;
    }

    const token = randomUUID();
    await this.redis.set(
      `recovery:${token}`,
      JSON.stringify({ email, createdAt: new Date().toISOString() }),
      'EX',
      TOKEN_TTL,
    );

    await this.recoveryEmailProducer.enqueue({
      email,
      firstName: keycloakUser.firstName ?? email.split('@')[0],
      token,
    });

    this.logger.log({ email }, 'recovery token created and email enqueued');
  }

  async validateToken(
    token: string,
  ): Promise<{ valid: true; email: string }> {
    const raw = await this.redis.get(`recovery:${token}`);

    if (!raw) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Token expirado ou inválido',
      });
    }

    const { email } = JSON.parse(raw) as { email: string };

    return { valid: true, email: maskEmail(email) };
  }

  async resetPassword(
    input: ResetPasswordInput,
    metadata: RequestMetadata,
  ): Promise<LoginResponse> {
    const { token, newPassword } = input;

    const raw = await this.redis.get(`recovery:${token}`);
    if (!raw) {
      throw new GoneException({
        statusCode: 410,
        error: 'Gone',
        message: 'Token expirado ou inválido',
      });
    }

    const { email } = JSON.parse(raw) as { email: string };

    const keycloakUser = await this.keycloakAdmin.findUserByEmail(email);
    if (!keycloakUser) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Usuário não encontrado',
      });
    }

    await this.keycloakAdmin.resetUserPassword(keycloakUser.id, newPassword);

    await this.redis.del(`recovery:${token}`);

    const tokens = await this.keycloakAdmin.authenticateUser(
      email,
      newPassword,
    );

    if (!tokens) {
      throw new Error('Failed to authenticate after password reset');
    }

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
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Usuário não encontrado',
      });
    }

    const sessionId = await this.sessionService.create(
      user.id,
      tokens.expiresIn,
      metadata,
    );

    this.logger.log(
      { userId: user.id, email, action: 'auth.recovery.completed' },
      'password reset and auto-login successful',
    );

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
          name: ut.tenantId,
          role: ut.role,
        })),
      },
    };
  }
}
