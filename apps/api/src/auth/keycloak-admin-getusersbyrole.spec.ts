/**
 * Integration spec — KeycloakAdminService.getUsersByRealmRole (Story 14-4, task 4.1.3)
 *
 * Mock HTTP do Keycloak; valida que retorna KeycloakUser[] corretamente parseado.
 * NFR-TEST-001: NUNCA bate no Keycloak real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeycloakAdminService } from './keycloak-admin.service';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfigService(): ConfigService {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      const map: Record<string, string> = {
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'metanoia',
        KEYCLOAK_API_CLIENT_ID: 'admin-cli',
        KEYCLOAK_API_CLIENT_SECRET: 'secret',
      };
      return map[key] ?? '';
    }),
  } as unknown as ConfigService;
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

describe('KeycloakAdminService.getUsersByRealmRole — integration (task 4.1.3)', () => {
  let service: KeycloakAdminService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new KeycloakAdminService(makeConfigService());
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna array de KeycloakUser[] para role existente (200)', async () => {
    const mockUsers = [
      { id: 'kc-id-1', email: 'admin1@test.com', firstName: 'Admin', lastName: 'One', enabled: true, emailVerified: true },
      { id: 'kc-id-2', email: 'admin2@test.com', firstName: 'Admin', lastName: 'Two', enabled: true, emailVerified: true },
    ];

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockUsers), { status: 200 }),
      );

    const result = await service.getUsersByRealmRole('super_admin');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'kc-id-1', email: 'admin1@test.com', enabled: true });
    expect(result[1]).toMatchObject({ id: 'kc-id-2', email: 'admin2@test.com', enabled: true });
  });

  it('retorna array vazio para role inexistente (404)', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response('Role not found', { status: 404 }),
      );

    const result = await service.getUsersByRealmRole('role_inexistente');
    expect(result).toEqual([]);
  });

  it('URL da requisição contém roleName corretamente', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );

    await service.getUsersByRealmRole('super_admin');

    const calls = fetchSpy.mock.calls;
    const rolesCall = calls.find(([url]) => typeof url === 'string' && url.includes('/roles/'));
    expect(rolesCall).toBeDefined();
    expect(rolesCall![0]).toContain('/roles/super_admin/users');
  });

  it('Authorization header usa Bearer token na requisição de roles', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'test-bearer-token', expires_in: 3600 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );

    await service.getUsersByRealmRole('super_admin');

    const calls = fetchSpy.mock.calls;
    const rolesCall = calls.find(([url]) => typeof url === 'string' && url.includes('/roles/'));
    const headers = rolesCall![1]?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBe('Bearer test-bearer-token');
  });
});
