import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ForgotPasswordSchema,
  type ForgotPasswordInput,
  ResetPasswordSchema,
  type ResetPasswordInput,
} from '@metanoia/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from './decorators/public.decorator';
import { PasswordRecoveryService } from './password-recovery.service';

@Controller('api/v1/auth')
export class PasswordRecoveryController {
  constructor(
    private readonly recoveryService: PasswordRecoveryService,
  ) {}

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) body: ForgotPasswordInput,
  ) {
    await this.recoveryService.requestRecovery(body.email);
    return {
      data: {
        message:
          'Se esse email existir na nossa base, você vai receber um link nos próximos segundos.',
      },
    };
  }

  @Public()
  @Get('reset-password/:token/validate')
  async validateToken(@Param('token') token: string) {
    const result = await this.recoveryService.validateToken(token);
    return { data: result };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) body: ResetPasswordInput,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const result = await this.recoveryService.resetPassword(body, {
      ipAddress,
      userAgent,
    });
    return { data: result };
  }
}
