import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  AcceptConsentInputSchema,
  type AcceptConsentInput,
  ConsentTypeSchema,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { getRequestContext } from '../common/context/request-context';
import { ConsentService } from './consent.service';
import { SkipConsent } from './consent.guard';

@Controller('api/v1/consent')
@UseGuards(KeycloakAuthGuard)
@SkipConsent()
export class ConsentController {
  constructor(private readonly service: ConsentService) {}

  @Get('status')
  async status() {
    const { userId } = getRequestContext();
    return this.service.getStatus(userId ?? '');
  }

  @Get('history')
  async history() {
    const { userId, tenantId } = getRequestContext();
    return this.service.getHistory(userId ?? '', tenantId ?? null);
  }

  @Patch(':consentType/withdraw')
  @HttpCode(200)
  async withdraw(@Param('consentType') consentTypeRaw: string) {
    // Validate path param with Zod
    const parsed = ConsentTypeSchema.safeParse(consentTypeRaw);
    if (!parsed.success) {
      throw new (await import('@nestjs/common').then((m) => m.BadRequestException))(
        `Tipo de consentimento inválido: ${consentTypeRaw}`,
      );
    }
    const { userId, tenantId } = getRequestContext();
    return this.service.withdrawConsent(
      userId ?? '',
      tenantId ?? null,
      parsed.data,
    );
  }

  @Post('accept')
  @UsePipes(new ZodValidationPipe(AcceptConsentInputSchema))
  async accept(
    @Body() body: AcceptConsentInput,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.service.accept(body, {
      ipAddress: ipAddress || '0.0.0.0',
      userAgent: userAgent ?? 'unknown',
    });
  }
}
