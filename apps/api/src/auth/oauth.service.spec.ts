import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthService } from './oauth.service';
import { SessionService } from './session.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OAuthService', () => {
  let service: OAuthService;
  let configService: { get: ReturnType<typeof vi.fn> };
  let sessionService: { create: ReturnType<typeof vi.fn> };
  let prisma: {
    client: {
      user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
      consent: { findMany: ReturnType<typeof vi.fn> };
    };
  };

  const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(async () => {
    configService = {
      get: vi.fn((key: string) => {
        const config: Record<string, string> = {
          KEYCLOAK_URL: 'http://localhost:8080',
          KEYCLOAK_REALM: 'metanoia',
          KEYCLOAK_CLIENT_ID: 'metanoia-web',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key];
      }),
    };

    sessionService = { create: vi.fn().mockResolvedValue('session-id') };
    prisma = {
      client: {
        user: { findUnique: vi.fn(), create: vi.fn() },
        consent: { findMany: vi.fn() },
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: ConfigService, useValue: configService },
        { provide: SessionService, useValue: sessionService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(OAuthService);
  });

  it('should build correct Google redirect URL', () => {
    const url = service.getGoogleRedirectUrl('http://localhost:3001/api/v1/auth/google/callback');

    expect(url).toContain('http://localhost:8080/realms/metanoia/protocol/openid-connect/auth');
    expect(url).toContain('kc_idp_hint=google');
    expect(url).toContain('client_id=metanoia-web');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=openid+email+profile');
  });
});
