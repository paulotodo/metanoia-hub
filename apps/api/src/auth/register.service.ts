import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { generateId, type RegisterUser, type RegisterUserResponse } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { KeycloakAdminService, KeycloakConflictError } from './keycloak-admin.service';
import { PasswordCheckerService } from './password-checker.service';
import { EmailVerificationProducer } from './email-verification.producer';

interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class RegisterService {
  private readonly logger = new Logger(RegisterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly passwordChecker: PasswordCheckerService,
    private readonly emailVerification: EmailVerificationProducer,
  ) {}

  async register(input: RegisterUser, metadata: RequestMetadata): Promise<RegisterUserResponse> {
    const { email, password, name } = input;

    // 1. Check leaked password (HIBP k-anonymity)
    const isLeaked = await this.passwordChecker.isLeaked(password);
    if (isLeaked) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Esta senha foi encontrada em vazamentos de dados. Escolha outra senha.',
      });
    }

    // 2. Create user in Keycloak
    let keycloakId: string;
    try {
      const result = await this.keycloakAdmin.createUser(email, password, name);
      keycloakId = result.keycloakId;
    } catch (error) {
      if (error instanceof KeycloakConflictError) {
        // Generic error to prevent email enumeration
        this.logger.warn({ email }, 'duplicate registration attempt');
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: 'Nao foi possivel completar o cadastro. Tente novamente ou entre em contato com o suporte.',
        });
      }
      throw error;
    }

    // 3. Persist user in PostgreSQL (no tenant context — direct Prisma)
    const userId = generateId();
    try {
      await this.prisma.client.user.create({
        data: {
          id: userId,
          email,
          name,
          status: 'pending_verification',
          tenantId: null,
        },
      });

      // 4. Record platform-level consent
      await this.prisma.client.consent.create({
        data: {
          id: generateId(),
          userId,
          tenantId: null,
          documentType: 'terms_of_service',
          version: '1.0',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
    } catch (error) {
      // If DB insert fails after Keycloak creation, log for manual reconciliation
      this.logger.error(
        { email, keycloakId, error: (error as Error).message },
        'failed to persist user in database after keycloak creation',
      );
      throw error;
    }

    // 5. Enqueue email verification
    await this.emailVerification.enqueue({ userId, email });

    this.logger.log({ userId, email }, 'user registered successfully');

    return {
      id: userId,
      email,
      name,
      status: 'pending_verification',
    };
  }
}
