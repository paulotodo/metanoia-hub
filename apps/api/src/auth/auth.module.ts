import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KeycloakAuthGuard } from './keycloak.guard';
import { RolesGuard } from './roles.guard';
import { KeycloakAdminService } from './keycloak-admin.service';
import { PasswordCheckerService } from './password-checker.service';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';
import { EmailVerificationProducer } from './email-verification.producer';
import { EmailVerificationWorker } from './email-verification.worker';

@Module({
  controllers: [RegisterController],
  providers: [
    KeycloakAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: KeycloakAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    KeycloakAdminService,
    PasswordCheckerService,
    RegisterService,
    EmailVerificationProducer,
    EmailVerificationWorker,
  ],
  exports: [KeycloakAuthGuard, KeycloakAdminService],
})
export class AuthModule {}
