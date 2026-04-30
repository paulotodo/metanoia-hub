import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanLimitsModule } from '../common/plan-limits/plan-limits.module';
import { GroupMembersController } from './group-members.controller';
import { GroupMembersService } from './group-members.service';
import { GroupMembersRepository } from './group-members.repository';

@Module({
  imports: [PrismaModule, PlanLimitsModule],
  controllers: [GroupMembersController],
  providers: [GroupMembersService, GroupMembersRepository],
  exports: [GroupMembersService],
})
export class GroupMembersModule {}
