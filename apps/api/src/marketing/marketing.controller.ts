import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ContactMessageInputSchema,
  DemoRequestInputSchema,
  type ContactMessageInput,
  type ContactMessageResponse,
  type DemoRequestInput,
  type DemoRequestResponse,
} from '@metanoia/types';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MarketingRateLimitGuard } from './rate-limit.guard';
import { MarketingService } from './marketing.service';

@Controller('api/v1/marketing')
@UseGuards(MarketingRateLimitGuard)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Public()
  @Post('demo-requests')
  @HttpCode(HttpStatus.CREATED)
  async createDemoRequest(
    @Body(new ZodValidationPipe(DemoRequestInputSchema))
    body: DemoRequestInput,
    @Req() req: Request,
  ): Promise<DemoRequestResponse> {
    const metadata = this.extractMetadata(req);
    const record = await this.marketingService.createDemoRequest(
      body,
      metadata,
    );
    return { data: record };
  }

  @Public()
  @Post('contact-messages')
  @HttpCode(HttpStatus.CREATED)
  async createContactMessage(
    @Body(new ZodValidationPipe(ContactMessageInputSchema))
    body: ContactMessageInput,
    @Req() req: Request,
  ): Promise<ContactMessageResponse> {
    const metadata = this.extractMetadata(req);
    const record = await this.marketingService.createContactMessage(
      body,
      metadata,
    );
    return { data: record };
  }

  private extractMetadata(req: Request): {
    ipAddress: string;
    userAgent: string;
  } {
    return {
      ipAddress: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: (req.headers['user-agent'] ?? 'unknown').slice(0, 512),
    };
  }
}
