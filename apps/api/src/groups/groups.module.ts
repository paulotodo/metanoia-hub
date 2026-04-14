import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupsController } from './groups.controller';
import { GroupsRepository } from './groups.repository';
import { GroupsService } from './groups.service';

@Module({
  imports: [PrismaModule],
  controllers: [GroupsController],
  providers: [GroupsRepository, GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
