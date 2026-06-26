import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  VerifyEmailSchema,
  type VerifyEmailInput,
  ResendVerificationSchema,
  type ResendVerificationInput,
} from '@metanoia/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from './decorators/public.decorator';
import { EmailVerificationService } from './email-verification.service';

@Controller('api/v1/auth')
export class EmailVerificationController {
  constructor(private readonly service: EmailVerificationService) {}

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body(new ZodValidationPipe(VerifyEmailSchema)) body: VerifyEmailInput,
  ) {
    const result = await this.service.confirm(body.token);
    return { data: result };
  }

  @Public()
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.OK)
  async resend(
    @Body(new ZodValidationPipe(ResendVerificationSchema))
    body: ResendVerificationInput,
  ) {
    await this.service.resend(body.email);
    // Generic response regardless of account state (anti-enumeration).
    return {
      data: {
        message:
          'Se houver um cadastro pendente para esse e-mail, enviamos um novo link de confirmação.',
      },
    };
  }
}
