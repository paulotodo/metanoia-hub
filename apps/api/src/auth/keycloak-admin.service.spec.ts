import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { KeycloakAdminService, KeycloakConflictError } from './keycloak-admin.service';

const mockConfig = {
  KEYCLOAK_URL: 'http://localhost:8080',
  KEYCLOAK_REALM: 'metanoia',
  KEYCLOAK_API_CLIENT_ID: 'metanoia-api',
  KEYCLOAK_API_CLIENT_SECRET: 'test-secret',
};

function createService() {
  const configService = {
    get: vi.fn((key: string) => mockConfig[key as keyof typeof mockConfig]),
  } as unknown as ConfigService;
  return new KeycloakAdminService(configService);
}

describe('KeycloakAdminService', () => {
  let service: KeycloakAdminService;

  beforeEach(() => {
    service = createService();
    vi.restoreAllMocks();
  });

  describe('getAdminToken', () => {
    it('should obtain token from keycloak', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'test-token', expires_in: 300 }), {
          status: 200,
        }),
      );

      const token = await service.getAdminToken();
      expect(token).toBe('test-token');
    });

    it('should cache token on subsequent calls', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'cached-token', expires_in: 300 }), {
          status: 200,
        }),
      );

      await service.getAdminToken();
      await service.getAdminToken();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw on failed token request', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      );

      await expect(service.getAdminToken()).rejects.toThrow('Keycloak token request failed: 401');
    });
  });

  describe('createUser', () => {
    it('should create user and return keycloak id', async () => {
      const keycloakId = '550e8400-e29b-41d4-a716-446655440000';

      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 201,
            headers: { Location: `http://localhost:8080/admin/realms/metanoia/users/${keycloakId}` },
          }),
        );

      const result = await service.createUser('user@example.com', 'securePass123!', 'John Doe');
      expect(result.keycloakId).toBe(keycloakId);

      // Regression guard: realm doesn't enable registrationEmailAsUsername,
      // so the request body MUST include `username`. Without it Keycloak
      // returns 400 "User name is missing" and registration breaks E2E.
      const createUserCall = fetchSpy.mock.calls[1];
      const requestBody = JSON.parse((createUserCall?.[1]?.body as string) ?? '{}');
      expect(requestBody.username).toBe('user@example.com');
      expect(requestBody.email).toBe('user@example.com');
    });

    it('should throw KeycloakConflictError on 409', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response('Conflict', { status: 409 }));

      await expect(
        service.createUser('user@example.com', 'securePass123!', 'John Doe'),
      ).rejects.toThrow(KeycloakConflictError);
    });
  });

  describe('findUserByEmail', () => {
    it('should return user when found', async () => {
      const user = { id: 'kc-id', email: 'user@example.com', enabled: true, emailVerified: false };

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify([user]), { status: 200 }));

      const result = await service.findUserByEmail('user@example.com');
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

      const result = await service.findUserByEmail('nobody@example.com');
      expect(result).toBeNull();
    });
  });
});
