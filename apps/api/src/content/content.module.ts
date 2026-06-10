import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentController } from './content.controller';
import { ModuleController } from './modules/module.controller';
import { LessonController } from './lessons/lesson.controller';
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContentController, ModuleController, LessonController],
  providers: [ContentRepository, ContentService],
  exports: [ContentService],
})
export class ContentModule {}
