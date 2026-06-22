import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
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
  } as unknown as ConfigService<import('../config/env.validation').EnvConfig, true>;
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

  describe('createUserForTenant', () => {
    const tenantId = '0190ba6e-1f8a-7000-9000-000000000001';

    it('should create user with tenant_id (snake_case) attribute and set password via separate PUT', async () => {
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
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const result = await service.createUserForTenant({
        email: 'invitee@example.com',
        name: 'Jane Doe',
        password: 'Secret123!',
        tenantId,
      });

      expect(result.keycloakUserId).toBe(keycloakId);

      // Regression guard: the Keycloak protocol mapper reads
      // `user.attribute: "tenant_id"` (snake_case). Sending the attribute as
      // `tenantId` (camelCase) silently strips the claim from the JWT and
      // breaks login for every invited user.
      const createUserCall = fetchSpy.mock.calls[1];
      const requestBody = JSON.parse((createUserCall?.[1]?.body as string) ?? '{}');
      expect(requestBody.username).toBe('invitee@example.com');
      expect(requestBody.email).toBe('invitee@example.com');
      expect(requestBody.firstName).toBe('Jane');
      expect(requestBody.lastName).toBe('Doe');
      expect(requestBody.attributes).toEqual({ tenant_id: [tenantId] });
      expect(requestBody.attributes.tenantId).toBeUndefined();

      // Password is set on a separate PUT /reset-password — not on the create call.
      expect(requestBody.credentials).toBeUndefined();
      const passwordCall = fetchSpy.mock.calls[2];
      expect(passwordCall?.[0]).toBe(
        `http://localhost:8080/admin/realms/metanoia/users/${keycloakId}/reset-password`,
      );
      expect(passwordCall?.[1]?.method).toBe('PUT');
    });

    it('should throw ConflictException on 409 from create user', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response('Conflict', { status: 409 }));

      await expect(
        service.createUserForTenant({
          email: 'taken@example.com',
          name: 'Jane Doe',
          password: 'Secret123!',
          tenantId,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should throw when password reset returns non-2xx', async () => {
      const keycloakId = '550e8400-e29b-41d4-a716-446655440000';

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 201,
            headers: { Location: `http://localhost:8080/admin/realms/metanoia/users/${keycloakId}` },
          }),
        )
        .mockResolvedValueOnce(new Response('policy violation', { status: 400 }));

      await expect(
        service.createUserForTenant({
          email: 'invitee@example.com',
          name: 'Jane Doe',
          password: 'short',
          tenantId,
        }),
      ).rejects.toThrow(/Keycloak password reset failed: 400/);
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
  describe('getUsersByRealmRole', () => {
    const keycloakUsers = [
      { id: 'kc-001', email: 'admin@example.com', firstName: 'Admin', lastName: 'User', enabled: true, emailVerified: true },
      { id: 'kc-002', email: 'admin2@example.com', firstName: 'Admin2', lastName: 'User2', enabled: true, emailVerified: false },
    ];

    it('retorna lista de usuários com o role (Story 14-4 §FR-007)', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(keycloakUsers), { status: 200 }),
        );

      const result = await service.getUsersByRealmRole('super_admin');
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('kc-001');
      expect(result[1]?.email).toBe('admin2@example.com');
    });

    it('retorna [] quando role não existe (404)', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response('Not Found', { status: 404 }),
        );

      const result = await service.getUsersByRealmRole('role_inexistente');
      expect(result).toEqual([]);
    });

    it('lança erro para resposta não-200/404', async () => {
      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response('Internal Server Error', { status: 500 }),
        );

      await expect(service.getUsersByRealmRole('super_admin')).rejects.toThrow(
        'Keycloak role users fetch failed: 500',
      );
    });

    it('encode-URI-encodes o roleName no path', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        );

      await service.getUsersByRealmRole('super admin'); // espaço
      const roleCall = fetchSpy.mock.calls[1]?.[0] as string;
      expect(roleCall).toContain('super%20admin');
    });
  });

});
