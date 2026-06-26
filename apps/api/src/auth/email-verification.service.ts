import {
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import { EmailVerificationProducer } from './email-verification.producer';

/** Token lifetime: 24h. Long enough for the recipient to act, short enough to bound exposure. */
const TOKEN_TTL = 86_400;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_TTL = 3600; // 1 hour

function tokenKey(token: string): string {
  return `verify-email:${token}`;
}

function firstNameOf(name: string, email: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : email.split('@')[0];
}

/**
 * EmailVerificationService — registration e-mail confirmation.
 *
 * The Keycloak realm has no SMTP server configured, so verification is driven
 * here: a single-use token lives in Redis (TTL 24h) and the link is delivered
 * via EmailService/Resend by EmailVerificationWorker. Confirming the token
 * flips `emailVerified` in Keycloak and activates the platform user.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly producer: EmailVerificationProducer,
  ) {}

  /**
   * Issue a verification token, persist it in Redis, and enqueue the e-mail.
   * Called right after registration and by resend().
   */
  async issue(email: string, name: string): Promise<void> {
    const token = randomUUID();
    await this.redis.set(
      tokenKey(token),
      JSON.stringify({ email, createdAt: new Date().toISOString() }),
      'EX',
      TOKEN_TTL,
    );
    await this.producer.enqueue({
      email,
      firstName: firstNameOf(name, email),
      token,
    });
    this.logger.log({ email }, 'verification token issued and email enqueued');
  }

  /**
   * Confirm a token: mark the Keycloak identity verified and activate the
   * platform user. Idempotent on the DB side (updateMany scoped by status).
   */
  async confirm(token: string): Promise<{ verified: true; email: string }> {
    const raw = await this.redis.get(tokenKey(token));
    if (!raw) {
      throw new GoneException({
        statusCode: 410,
        error: 'Gone',
        message: 'Link de confirmação expirado ou inválido.',
      });
    }

    const { email } = JSON.parse(raw) as { email: string };

    const keycloakUser = await this.keycloakAdmin.findUserByEmail(email);
    if (!keycloakUser) {
      // Token valid but the identity is gone — burn the token and surface 404.
      await this.redis.del(tokenKey(token));
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: 'Usuário não encontrado.',
      });
    }

    await this.keycloakAdmin.markEmailVerified(keycloakUser.id);

    await this.prisma.client.user.updateMany({
      where: { email, status: 'pending_verification' },
      data: { status: 'active' },
    });

    await this.redis.del(tokenKey(token));
    this.logger.log(
      { email, action: 'auth.email.verified' },
      'email verified and user activated',
    );

    return { verified: true, email };
  }

  /**
   * Re-send the verification e-mail. Rate-limited and anti-enumeration: the
   * caller always gets the same generic response from the controller.
   */
  async resend(email: string): Promise<void> {
    const rateKey = `rate:verify:${email}`;
    const count = await this.redis.incr(rateKey);
    if (count === 1) {
      await this.redis.expire(rateKey, RATE_LIMIT_TTL);
    }
    if (count > RATE_LIMIT_MAX) {
      this.logger.warn({ email }, 'verification resend rate limit exceeded');
      return;
    }

    const keycloakUser = await this.keycloakAdmin.findUserByEmail(email);
    // Silent no-op when the user doesn't exist or is already verified.
    if (!keycloakUser || keycloakUser.emailVerified) {
      return;
    }

    const name = keycloakUser.firstName ?? email.split('@')[0];
    await this.issue(email, name);
  }
}
