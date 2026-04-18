import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KeycloakAuthGuard } from './keycloak.guard';
import { RolesGuard } from './roles.guard';
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
  ],
  providers: [
    KeycloakAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: KeycloakAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    KeycloakAdminService,
    PasswordCheckerService,
    RegisterService,
    LoginService,
    OAuthService,
    SessionService,
    EmailVerificationProducer,
    EmailVerificationWorker,
    TenantSelectionService,
    PasswordRecoveryService,
    RecoveryEmailProducer,
    RecoveryEmailWorker,
  ],
  exports: [KeycloakAuthGuard, KeycloakAdminService],
})
export class AuthModule {}
