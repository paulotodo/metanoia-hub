import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InvitesController } from './invites.controller';
import { InvitesRepository } from './invites.repository';
import { InvitesService } from './invites.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InvitesController],
  providers: [InvitesRepository, InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
