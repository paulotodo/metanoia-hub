import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanLimitsModule } from '../common/plan-limits/plan-limits.module';
import { GroupsController } from './groups.controller';
import { GroupsRepository } from './groups.repository';
import { GroupsService } from './groups.service';
import { GroupTrailsController } from './trails/group-trails.controller';
import { GroupTrailsRepository } from './trails/group-trails.repository';
import { GroupTrailsService } from './trails/group-trails.service';

@Module({
  imports: [PrismaModule, PlanLimitsModule],
  controllers: [GroupsController, GroupTrailsController],
  providers: [
    GroupsRepository,
    GroupsService,
    GroupTrailsRepository,
    GroupTrailsService,
  ],
  exports: [GroupsService],
})
export class GroupsModule {}
