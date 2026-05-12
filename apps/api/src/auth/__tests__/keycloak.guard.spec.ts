import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { KeycloakAuthGuard } from '../keycloak.guard';
import { RedisService } from '../../redis/redis.service';
import { requestContext } from '../../common/context/request-context';

// Mock jose module
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';

const mockConfig = {
  get: vi.fn((key: string) => {
    const map: Record<string, string> = {
      KEYCLOAK_URL: 'http://localhost:8080',
      KEYCLOAK_REALM: 'metanoia',
      KEYCLOAK_EXPECTED_AUDIENCE: 'metanoia-api',
    };
    return map[key];
  }),
};

const validPayload = {
  sub: 'user-uuid-123',
  user_id: 'user-uuid-123',
  tenant_id: 'tenant-001',
  realm_roles: ['lider'],
  email: 'lider@metanoia.dev',
  email_verified: true,
  preferred_username: 'lider@metanoia.dev',
  iss: 'http://localhost:8080/realms/metanoia',
  aud: ['metanoia-web', 'metanoia-api'],
  exp: Math.floor(Date.now() / 1000) + 300,
  iat: Math.floor(Date.now() / 1000),
};

function createMockExecutionContext(
  headers: Record<string, string> = {},
  metadata: Record<string, unknown> = {},
) {
  const request = { headers, user: undefined as unknown };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    _request: request,
    _metadata: metadata,
  };
}

describe('KeycloakAuthGuard', () => {
  let guard: KeycloakAuthGuard;
  let reflector: Reflector;
  let redis: { get: ReturnType<typeof vi.fn> };
  let mockStore: { tenantId: string; userId?: string; requestId: string; correlationId: string };

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.mocked(jwtVerify).mockReset();

    mockStore = { tenantId: '', requestId: '', correlationId: '' };
    vi.spyOn(requestContext, 'getStore').mockReturnValue(mockStore);

    redis = { get: vi.fn().mockResolvedValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        KeycloakAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: vi.fn(() => false),
          },
        },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    guard = module.get(KeycloakAuthGuard);
    reflector = module.get(Reflector);

    // Trigger onModuleInit to set up JWKS and issuer
    guard.onModuleInit();
  });

  it('should allow request with valid JWT and populate request.user', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: validPayload,
      protectedHeader: { alg: 'RS256' },
    } as any);

    const ctx = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    const result = await guard.canActivate(ctx as any);

    expect(result).toBe(true);
    expect(ctx._request.user).toEqual({
      userId: 'user-uuid-123',
      tenantId: 'tenant-001',
      roles: ['lider'],
      email: 'lider@metanoia.dev',
    });
  });

  it('should throw UnauthorizedException when no Authorization header', async () => {
    const ctx = createMockExecutionContext({});

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Missing authentication token',
    );
  });

  it('should throw UnauthorizedException for expired token', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(
      new Error('"exp" claim timestamp check failed — token expired'),
    );

    const ctx = createMockExecutionContext({
      authorization: 'Bearer expired-token',
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Token has expired',
    );
  });

  it('should throw UnauthorizedException for malformed token', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid Compact JWS'));

    const ctx = createMockExecutionContext({
      authorization: 'Bearer malformed-garbage',
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Invalid authentication token',
    );
  });

  it('should throw UnauthorizedException when tenant_id is missing from token', async () => {
    const payloadWithoutTenant = { ...validPayload, tenant_id: undefined };
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: payloadWithoutTenant,
      protectedHeader: { alg: 'RS256' },
    } as any);

    const ctx = createMockExecutionContext({
      authorization: 'Bearer token-no-tenant',
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Missing tenant_id claim in token',
    );
  });

  it('should skip authentication for @Public() endpoints', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);

    const ctx = createMockExecutionContext({});

    const result = await guard.canActivate(ctx as any);

    expect(result).toBe(true);
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('should populate AsyncLocalStorage store with correct values', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: validPayload,
      protectedHeader: { alg: 'RS256' },
    } as any);

    const ctx = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    await guard.canActivate(ctx as any);

    expect(mockStore.tenantId).toBe('tenant-001');
    expect(mockStore.userId).toBe('user-uuid-123');
  });

  it('should reject non-Bearer authorization schemes', async () => {
    const ctx = createMockExecutionContext({
      authorization: 'Basic dXNlcjpwYXNz',
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Missing authentication token',
    );
  });

  it('should fallback to sub when user_id is not in token', async () => {
    const payloadWithoutUserId = { ...validPayload, user_id: undefined };
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: payloadWithoutUserId,
      protectedHeader: { alg: 'RS256' },
    } as any);

    const ctx = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    await guard.canActivate(ctx as any);

    expect(ctx._request.user).toEqual(
      expect.objectContaining({ userId: 'user-uuid-123' }),
    );
  });

  it('should override tenant_id with active-tenant stored in Redis', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: validPayload,
      protectedHeader: { alg: 'RS256' },
    } as any);
    redis.get.mockResolvedValue('tenant-override-42');

    const ctx = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    await guard.canActivate(ctx as any);

    expect(redis.get).toHaveBeenCalledWith('user:user-uuid-123:active-tenant');
    expect(mockStore.tenantId).toBe('tenant-override-42');
    expect(ctx._request.user).toEqual(
      expect.objectContaining({ tenantId: 'tenant-override-42' }),
    );
  });

  it('should fallback to JWT tenant_id when Redis lookup fails', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: validPayload,
      protectedHeader: { alg: 'RS256' },
    } as any);
    redis.get.mockRejectedValue(new Error('redis down'));

    const ctx = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    await guard.canActivate(ctx as any);

    expect(mockStore.tenantId).toBe('tenant-001');
  });

  it('should handle JWKS endpoint unreachable errors', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(
      new Error('request to http://localhost:8080 failed, reason: ECONNREFUSED'),
    );

    const ctx = createMockExecutionContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Authentication service unavailable',
    );
  });

  describe('audience validation', () => {
    it('passes when jwtVerify is invoked with the expected audience and resolves', async () => {
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: validPayload,
        protectedHeader: { alg: 'RS256' },
      } as any);

      const ctx = createMockExecutionContext({
        authorization: 'Bearer aud-metanoia-api',
      });

      await guard.canActivate(ctx as any);

      expect(jwtVerify).toHaveBeenCalledWith(
        'aud-metanoia-api',
        'mock-jwks',
        expect.objectContaining({
          issuer: 'http://localhost:8080/realms/metanoia',
          audience: 'metanoia-api',
        }),
      );
    });

    it('rejects when jose throws audience claim check failed (token aud=metanoia-web only)', async () => {
      vi.mocked(jwtVerify).mockRejectedValue(
        new Error("\"aud\" claim check failed"),
      );

      const ctx = createMockExecutionContext({
        authorization: 'Bearer web-only-token',
      });

      await expect(guard.canActivate(ctx as any)).rejects.toThrow(
        'Invalid authentication token',
      );
    });

    it('passes for multi-audience token containing metanoia-api', async () => {
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { ...validPayload, aud: ['metanoia-web', 'metanoia-api'] },
        protectedHeader: { alg: 'RS256' },
      } as any);

      const ctx = createMockExecutionContext({
        authorization: 'Bearer multi-aud-token',
      });

      const result = await guard.canActivate(ctx as any);
      expect(result).toBe(true);
    });

    it('rejects token whose aud is a different client', async () => {
      vi.mocked(jwtVerify).mockRejectedValue(
        new Error("audience claim check failed"),
      );

      const ctx = createMockExecutionContext({
        authorization: 'Bearer other-client-token',
      });

      await expect(guard.canActivate(ctx as any)).rejects.toThrow(
        'Invalid authentication token',
      );
    });
  });

  describe('immutable post-init state', () => {
    it('throws TypeError when issuer is reassigned after onModuleInit', () => {
      expect(() => {
        (guard as any).issuer = 'http://evil/realms/metanoia';
      }).toThrow(TypeError);
    });

    it('throws TypeError when expectedAudience is reassigned after onModuleInit', () => {
      expect(() => {
        (guard as any).expectedAudience = 'attacker-controlled';
      }).toThrow(TypeError);
    });

    it('throws TypeError when jwks is reassigned after onModuleInit', () => {
      expect(() => {
        (guard as any).jwks = 'rogue-jwks';
      }).toThrow(TypeError);
    });

    it('freezes request.user so handlers cannot mutate roles or tenantId', async () => {
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: validPayload,
        protectedHeader: { alg: 'RS256' },
      } as any);

      const ctx = createMockExecutionContext({
        authorization: 'Bearer valid-token',
      });

      await guard.canActivate(ctx as any);
      const user = ctx._request.user as any;

      expect(Object.isFrozen(user)).toBe(true);
      expect(Object.isFrozen(user.roles)).toBe(true);
      expect(() => {
        user.tenantId = 'evil-tenant';
      }).toThrow(TypeError);
      expect(() => {
        user.roles.push('admin_tenant');
      }).toThrow(TypeError);
    });
  });
});
