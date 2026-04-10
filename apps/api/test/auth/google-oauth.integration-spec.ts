import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../../src/auth/oauth.service';
import { SessionService } from '../../src/auth/session.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Google OAuth Flow (Integration)', () => {
  let oauthService: OAuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, string> = {
                KEYCLOAK_URL: 'http://localhost:8080',
                KEYCLOAK_REALM: 'metanoia',
                KEYCLOAK_CLIENT_ID: 'metanoia-web',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return config[key];
            },
          },
        },
        { provide: SessionService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    oauthService = module.get(OAuthService);
  });

  it('should build redirect URL with kc_idp_hint=google', () => {
    const callbackUrl = 'http://localhost:3001/api/v1/auth/google/callback';
    const url = oauthService.getGoogleRedirectUrl(callbackUrl);

    expect(url).toContain('http://localhost:8080/realms/metanoia/protocol/openid-connect/auth');
    expect(url).toContain('kc_idp_hint=google');
    expect(url).toContain('client_id=metanoia-web');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=openid+email+profile');
    expect(url).toContain(encodeURIComponent(callbackUrl));
  });

  it('should include correct redirect_uri in the URL', () => {
    const callbackUrl = 'https://api.metanoia.com/api/v1/auth/google/callback';
    const url = oauthService.getGoogleRedirectUrl(callbackUrl);

    expect(url).toContain(encodeURIComponent(callbackUrl));
  });
});
