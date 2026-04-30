import { join } from 'node:path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { BullMqModule } from './bullmq/bullmq.module';
import { MeetingsModule } from './meetings/meetings.module';
import { PastoralModule } from './pastoral/pastoral.module';
import { AdminPastoralModule } from './admin-pastoral/admin-pastoral.module';
import { InvitesModule } from './invites/invites.module';
import { TenantsModule } from './tenants/tenants.module';
import { GroupsModule } from './groups/groups.module';
import { ParticipantGroupsModule } from './participant-groups/participant-groups.module';
import { SuperAdminTenantsModule } from './super-admin/super-admin-tenants.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { MarketingModule } from './marketing/marketing.module';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
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
    LoggerModule.forRoot(pinoLoggerConfig()),
    AuthModule,
    PrismaModule,
    RedisModule,
    BullMqModule,
    HealthModule,
    MeetingsModule,
    PastoralModule,
    AdminPastoralModule,
    InvitesModule,
    TenantsModule,
    GroupsModule,
    ParticipantGroupsModule,
    SuperAdminTenantsModule,
    OnboardingModule,
    MarketingModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
