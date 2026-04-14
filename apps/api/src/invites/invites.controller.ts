import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  AcceptTermsRequestSchema,
  CreateAccountRequestSchema,
  type AcceptTermsRequest,
  type CreateAccountRequest,
} from '@metanoia/types';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { InvitesService } from './invites.service';

/**
 * InvitesController — pre-tenant onboarding entry points. Routes are marked
 * @Public because the token itself is the authorization artifact; the global
 * KeycloakAuthGuard would otherwise reject unauthenticated requests.
 */
@Controller('api/v1/invites')
@Public()
export class InvitesController {
  constructor(private readonly service: InvitesService) {}

  @Get(':token')
  async validate(@Param('token') token: string) {
    const data = await this.service.validateToken(token);
    return { data };
  }

  @Post(':token/accept-terms')
  @HttpCode(HttpStatus.OK)
  async acceptTerms(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(AcceptTermsRequestSchema)) body: AcceptTermsRequest,
  ) {
    const data = await this.service.acceptTerms(token, body);
    return { data };
  }

  @Post(':token/create-account')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(CreateAccountRequestSchema)) body: CreateAccountRequest,
  ) {
    const data = await this.service.createAccount(token, body);
    return { data };
  }
}
