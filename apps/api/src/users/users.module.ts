import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CheckEmailsRateLimitGuard } from './check-emails-rate-limit.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, CheckEmailsRateLimitGuard],
  exports: [UsersService],
})
export class UsersModule {}
