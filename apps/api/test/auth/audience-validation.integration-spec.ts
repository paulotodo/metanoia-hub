import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';
import type { KeyLike } from 'jose';
import { KeycloakAuthGuard } from '../../src/auth/keycloak.guard';
import { RedisService } from '../../src/redis/redis.service';
import { requestContext } from '../../src/common/context/request-context';

const ISSUER = 'http://localhost:8080/realms/metanoia';
const EXPECTED_AUDIENCE = 'metanoia-api';

vi.mock('jose', async () => {
  const actual = await vi.importActual<typeof import('jose')>('jose');
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(),
  };
});

import { createRemoteJWKSet } from 'jose';

function createMockExecutionContext(headers: Record<string, string> = {}) {
  const request = { headers, user: undefined as unknown };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    _request: request,
  };
}

async function signToken(
  privateKey: KeyLike,
  payload: Record<string, unknown>,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

describe('Audience validation (integration with real jose)', () => {
  let guard: KeycloakAuthGuard;
  let publicKey: KeyLike;
  let privateKey: KeyLike;

  beforeEach(async () => {
    const keys = await generateKeyPair('RS256');
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;

    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';

    // Mock createRemoteJWKSet to resolve our local public key for any kid lookup.
    vi.mocked(createRemoteJWKSet).mockReturnValue(async () => publicKey as any);

    vi.spyOn(requestContext, 'getStore').mockReturnValue({
      tenantId: '',
      requestId: '',
      correlationId: '',
    });

    const module = await Test.createTestingModule({
      providers: [
        KeycloakAuthGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: () => false },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                KEYCLOAK_URL: 'http://localhost:8080',
                KEYCLOAK_REALM: 'metanoia',
                KEYCLOAK_EXPECTED_AUDIENCE: EXPECTED_AUDIENCE,
              };
              return map[key];
            },
          },
        },
        {
          provide: RedisService,
          useValue: { get: async () => null },
        },
      ],
    }).compile();

    guard = module.get(KeycloakAuthGuard);
    guard.onModuleInit();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a token whose aud array includes metanoia-api', async () => {
    const token = await signToken(privateKey, {
      sub: 'user-1',
      user_id: 'user-1',
      tenant_id: 'tenant-1',
      realm_roles: ['lider'],
      email: 'lider@metanoia.dev',
      aud: ['metanoia-web', EXPECTED_AUDIENCE],
    });

    const ctx = createMockExecutionContext({
      authorization: `Bearer ${token}`,
    });

    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
    expect((ctx._request.user as any).userId).toBe('user-1');
  });

  it('rejects a forged token whose aud does not contain metanoia-api', async () => {
    const token = await signToken(privateKey, {
      sub: 'attacker',
      user_id: 'attacker',
      tenant_id: 'tenant-x',
      realm_roles: [],
      aud: 'metanoia-web',
    });

    const ctx = createMockExecutionContext({
      authorization: `Bearer ${token}`,
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Invalid authentication token',
    );
  });

  it('rejects a token signed for an unrelated client', async () => {
    const token = await signToken(privateKey, {
      sub: 'attacker',
      user_id: 'attacker',
      tenant_id: 'tenant-x',
      realm_roles: [],
      aud: 'unrelated-client',
    });

    const ctx = createMockExecutionContext({
      authorization: `Bearer ${token}`,
    });

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Invalid authentication token',
    );
  });
});
