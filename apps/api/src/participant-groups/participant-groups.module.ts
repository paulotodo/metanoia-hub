import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ParticipantGroupsController } from './participant-groups.controller';
import { ParticipantGroupsRepository } from './participant-groups.repository';
import { ParticipantGroupsService } from './participant-groups.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ParticipantGroupsController],
  providers: [ParticipantGroupsRepository, ParticipantGroupsService],
})
export class ParticipantGroupsModule {}
