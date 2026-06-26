import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KeycloakAuthGuard } from './keycloak.guard';
import { RolesGuard } from './roles.guard';
import { TenantGuard } from './guards/tenant.guard';
import { KeycloakAdminService } from './keycloak-admin.service';
import { PasswordCheckerService } from './password-checker.service';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { SessionService } from './session.service';
import { EmailVerificationProducer } from './email-verification.producer';
import { EmailVerificationWorker } from './email-verification.worker';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationController } from './email-verification.controller';
import { EmailService } from '../notifications/channels/email.service';
import { TenantSelectionController } from './tenant-selection.controller';
import { TenantSelectionService } from './tenant-selection.service';
import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';
import { RecoveryEmailProducer } from './recovery-email.producer';
import { RecoveryEmailWorker } from './recovery-email.worker';

@Module({
  controllers: [
    RegisterController,
    LoginController,
    OAuthController,
    TenantSelectionController,
    PasswordRecoveryController,
    EmailVerificationController,
  ],
  providers: [
    KeycloakAuthGuard,
    RolesGuard,
    TenantGuard,
    // Order matters: KeycloakAuthGuard (JWT) → RolesGuard (roles) → TenantGuard (tenant isolation)
    { provide: APP_GUARD, useClass: KeycloakAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    KeycloakAdminService,
    PasswordCheckerService,
    RegisterService,
    LoginService,
    OAuthService,
    SessionService,
    EmailVerificationProducer,
    EmailVerificationWorker,
    EmailVerificationService,
    // EmailService (Resend) is a thin, stateless wrapper (ConfigService only).
    // Provided directly here to avoid importing NotificationsModule (cycle risk).
    EmailService,
    TenantSelectionService,
    PasswordRecoveryService,
    RecoveryEmailProducer,
    RecoveryEmailWorker,
  ],
  exports: [KeycloakAuthGuard, KeycloakAdminService],
})
export class AuthModule {}
