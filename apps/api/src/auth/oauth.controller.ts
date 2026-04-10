import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';
import { Public } from './decorators/public.decorator';
import { OAuthService } from './oauth.service';

@Controller('api/v1/auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Public()
  @Get('google')
  googleRedirect(@Req() req: Request, @Res() res: Response) {
    const callbackUrl = this.buildCallbackUrl(req);
    const redirectUrl = this.oauthService.getGoogleRedirectUrl(callbackUrl);
    res.redirect(redirectUrl);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const callbackUrl = this.buildCallbackUrl(req);
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const result = await this.oauthService.handleCallback(code, callbackUrl, {
      ipAddress,
      userAgent,
    });

    const frontendUrl = this.config.get('FRONTEND_URL');
    const params = new URLSearchParams({
      session_id: result.sessionId,
      has_consent: String(result.hasConsent),
      expires_in: String(result.expiresIn),
    });

    // Tokens in hash fragment — never sent to server
    const hash = `access_token=${result.accessToken}&refresh_token=${result.refreshToken}`;
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}#${hash}`);
  }

  private buildCallbackUrl(req: Request): string {
    const protocol = req.headers['x-forwarded-proto'] ?? req.protocol;
    const host = req.headers['x-forwarded-host'] ?? req.get('host');
    return `${protocol}://${host}/api/v1/auth/google/callback`;
  }
}
