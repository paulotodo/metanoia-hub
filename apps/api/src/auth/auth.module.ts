import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KeycloakAuthGuard } from './keycloak.guard';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [
    KeycloakAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: KeycloakAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [KeycloakAuthGuard],
})
export class AuthModule {}
