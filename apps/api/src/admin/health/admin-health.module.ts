import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthCheckController } from './health-check.controller';
import { HealthCheckService } from './health-check.service';
import { IntegrationHealthProcessor } from './health-check.processor';
import { ResendHealthPort } from './resend-health.port';
import { AuthModule } from '../../auth/auth.module';
import { AuditModule } from '../../audit/audit.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { BullMqModule } from '../../bullmq/bullmq.module';

/**
 * AdminHealthModule — Story 14-4 (NFR-I5).
 *
 * Responsabilidades:
 *  - GET /api/v1/admin/health/integrations — 5 probes + micro-cache
 *  - GET /api/v1/admin/health/integrations/history — sparkline 24h
 *  - BullMQ worker periódico (a cada 5min) com Redis lock
 *  - Persistência em integration_health_log via createPrivilegedClient()
 *  - Notificação de Super Admins com debounce anti-flapping
 *  - ResendHealthPort: implementação real de EmailHealthPort (fecha StubEmailHealthPort)
 *
 * Exports: ResendHealthPort → NotificationsModule pode usar para o circuit breaker (14-3).
 * Nota: NotificationsModule importado aqui para acesso ao NotificationsService.
 *       AuthModule exporta KeycloakAdminService necessário para getUsersByRealmRole.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    BullMqModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [
    HealthCheckService,
    IntegrationHealthProcessor,
    ResendHealthPort,
  ],
  controllers: [HealthCheckController],
  exports: [ResendHealthPort],
})
export class AdminHealthModule {}
