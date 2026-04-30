import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminInvitesController } from './admin-invites.controller';
import { AdminInvitesService } from './admin-invites.service';
import { AdminInvitesRepository } from './admin-invites.repository';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AdminInvitesController],
  providers: [AdminInvitesService, AdminInvitesRepository],
  exports: [AdminInvitesService],
})
export class AdminInvitesModule {}
