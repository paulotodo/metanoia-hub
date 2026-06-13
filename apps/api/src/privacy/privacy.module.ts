import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { ConsentModule } from '../consent/consent.module';
import { ContentModule } from '../content/content.module';
import { GroupMembersModule } from '../group-members/group-members.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { PastoralModule } from '../pastoral/pastoral.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyRateLimitGuard } from './privacy-rate-limit.guard';
import { PrivacyService } from './privacy.service';
import { PrivacyExportService } from './privacy-export.service';
import { PrivacyExportProcessor } from './privacy-export.processor';
import { PrivacyDeletionService } from './privacy-deletion.service';
import { PrivacyDeletionProcessor } from './privacy-deletion.processor';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuditModule,
    ConsentModule,
    ContentModule,
    GroupMembersModule,
    MeetingsModule,
    PastoralModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [PrivacyController],
  providers: [
    PrivacyService,
    PrivacyRateLimitGuard,
    PrivacyExportService,
    PrivacyExportProcessor,
    PrivacyDeletionService,
    PrivacyDeletionProcessor,
  ],
  exports: [PrivacyExportService, PrivacyDeletionService],
})
export class PrivacyModule {}
