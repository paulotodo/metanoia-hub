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
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';
import { UploadService } from './upload/upload.service';
import { ProgressService } from './progress/progress.service';
import { ProgressProcessor } from './progress/progress.processor';

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
  ],
  providers: [ContentRepository, ContentService, UploadService, ProgressService, ProgressProcessor],
  exports: [ContentService, UploadService, ProgressService],
})
export class ContentModule {}
