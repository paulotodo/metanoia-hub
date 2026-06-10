import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ContentController } from './content.controller';
import { ModuleController } from './modules/module.controller';
import { LessonController } from './lessons/lesson.controller';
import { SignedUrlController } from './signed-url/signed-url.controller';
import { UploadController } from './upload/upload.controller';
import { ProgressController } from './progress/progress.controller';
import { ContentConfigController } from './config/content-config.controller';
import { PrerequisitesController } from './prerequisites/prerequisites.controller';
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';
import { UploadService } from './upload/upload.service';
import { ProgressService } from './progress/progress.service';
import { ProgressProcessor } from './progress/progress.processor';
import { CompletionRulesService } from './completion/completion-rules.service';
import { ContentConfigService } from './config/content-config.service';
import { AccessControlService } from './access/access-control.service';
import { CircularDependencyValidator } from './access/circular-dependency.validator';
import { PrerequisitesService } from './prerequisites/prerequisites.service';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    // In-memory storage for multipart uploads — no disk temp files
    MulterModule.register({}),
  ],
  controllers: [
    ContentController,
    ModuleController,
    LessonController,
    UploadController,
    SignedUrlController,
    ProgressController,
    ContentConfigController,
    PrerequisitesController,
  ],
  providers: [
    ContentRepository,
    ContentService,
    UploadService,
    ProgressService,
    ProgressProcessor,
    CompletionRulesService,
    ContentConfigService,
    AccessControlService,
    CircularDependencyValidator,
    PrerequisitesService,
  ],
  exports: [ContentService, UploadService, ProgressService, CompletionRulesService, AccessControlService],
})
export class ContentModule {}
