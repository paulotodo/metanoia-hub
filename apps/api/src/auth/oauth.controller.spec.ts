import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

describe('OAuthController', () => {
  let controller: OAuthController;
  let oauthService: {
    getGoogleRedirectUrl: ReturnType<typeof vi.fn>;
    handleCallback: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    oauthService = {
      getGoogleRedirectUrl: vi.fn().mockReturnValue('https://keycloak/auth?kc_idp_hint=google'),
      handleCallback: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        { provide: OAuthService, useValue: oauthService },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(OAuthController);
  });

  it('should redirect to Google via Keycloak', () => {
    const req = {
      protocol: 'http',
      headers: {},
      get: vi.fn().mockReturnValue('localhost:3001'),
    } as any;
    const res = { redirect: vi.fn() } as any;

    controller.googleRedirect(req, res);

    expect(res.redirect).toHaveBeenCalledWith('https://keycloak/auth?kc_idp_hint=google');
    expect(oauthService.getGoogleRedirectUrl).toHaveBeenCalled();
  });

  it('should handle callback and redirect to frontend', async () => {
    oauthService.handleCallback.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      sessionId: 'session-id',
      hasConsent: true,
    });

    const req = {
      ip: '127.0.0.1',
      protocol: 'http',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'test-agent' },
      get: vi.fn().mockReturnValue('localhost:3001'),
    } as any;
    const res = { redirect: vi.fn() } as any;

    await controller.googleCallback('auth-code', req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/auth/callback'),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('access_token=access-token'),
    );
  });
});
