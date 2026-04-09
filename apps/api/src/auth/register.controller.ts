import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RegisterUserSchema, type RegisterUser } from '@metanoia/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from './decorators/public.decorator';
import { RegisterService } from './register.service';

@Controller('api/v1/auth')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(RegisterUserSchema)) body: RegisterUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const result = await this.registerService.register(body, { ipAddress, userAgent });
    return { data: result };
  }
}
