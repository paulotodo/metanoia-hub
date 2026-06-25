import { join } from 'node:path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, type EnvConfig } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { BullMqModule } from './bullmq/bullmq.module';
import { MeetingsModule } from './meetings/meetings.module';
import { PastoralModule } from './pastoral/pastoral.module';
import { AdminPastoralModule } from './admin-pastoral/admin-pastoral.module';
import { RadarDashboardModule } from './pastoral/dashboard/radar-dashboard.module';
import { InvitesModule } from './invites/invites.module';
import { TenantsModule } from './tenants/tenants.module';
import { GroupsModule } from './groups/groups.module';
import { ParticipantGroupsModule } from './participant-groups/participant-groups.module';
import { SuperAdminTenantsModule } from './super-admin/super-admin-tenants.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AdminAccessibilityModule } from './admin-accessibility/admin-accessibility.module';
import { ConsentModule } from './consent/consent.module';
import { GroupMembersModule } from './group-members/group-members.module';
import { AdminInvitesModule } from './admin-invites/admin-invites.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { UsersModule } from './users/users.module';
import { MarketingModule } from './marketing/marketing.module';
import { PrivacyModule } from './privacy/privacy.module';
import { ObservabilityModule } from './observability/observability.module';
import { ContentModule } from './content/content.module';
import { ReportsModule } from './reports/reports.module';
import { SearchModule } from './search/search.module';
import { AuditModule } from './audit/audit.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminHealthModule } from './admin/health/admin-health.module';
import { LastSeenInterceptor } from './common/interceptors/last-seen.interceptor';
import { pinoLoggerConfig } from './common/logger/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env.local'),
        join(__dirname, '..', '.env'),
        join(__dirname, '..', '..', '..', '.env'),
      ],
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        pinoLoggerConfig(config),
    }),
    AuthModule,
    PrismaModule,
    RedisModule,
    BullMqModule,
    HealthModule,
    MeetingsModule,
    // RadarDashboardModule antes de PastoralModule: a rota estática
    // GET /radar/dashboard precisa ser registrada antes da rota paramétrica
    // GET /radar/:id (Express casa por ordem de registro), senão "dashboard"
    // é tratado como :id e o ParseUUIDPipe responde 400.
    RadarDashboardModule,
    PastoralModule,
    AdminPastoralModule,
    InvitesModule,
    TenantsModule,
    GroupsModule,
    ParticipantGroupsModule,
    SuperAdminTenantsModule,
    AdminUsersModule,
    AdminAccessibilityModule,
    ConsentModule,
    GroupMembersModule,
    AdminInvitesModule,
    OnboardingModule,
    UsersModule,
    MarketingModule,
    PrivacyModule,
    ObservabilityModule,
    ContentModule,
    ReportsModule,
    SearchModule,
    AuditModule,
    NotificationsModule,
    AdminHealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LastSeenInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
