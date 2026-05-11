import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ProtocolMapper {
  name: string;
  protocolMapper: string;
  config?: Record<string, string>;
}
interface Client {
  clientId: string;
  protocolMappers?: ProtocolMapper[];
}
interface RealmExport {
  realm: string;
  clients?: Client[];
  users?: Array<{ username: string; attributes?: Record<string, string[]> }>;
}

const realm = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', '..', 'infra', 'keycloak', 'realm-export.json'),
    'utf8',
  ),
) as RealmExport;

/**
 * Story 7-6 — regression guard for the tenant_id JWT claim invariant.
 *
 * Three sources must agree on the snake_case key `tenant_id`:
 *  1. Every client's protocol mapper exposing the claim.
 *  2. The user.attribute the mapper reads from.
 *  3. The body `KeycloakAdminService.createUserForTenant` sends when
 *     provisioning invited users (covered by the unit spec).
 *
 * If any of these drifts to camelCase (`tenantId`) the claim disappears from
 * the JWT and invited users land in the app without a tenant context.
 */
describe('Keycloak realm — tenant_id claim mapper', () => {
  it('every client that maps tenant_id reads user.attribute "tenant_id" (snake_case)', () => {
    const mappers = (realm.clients ?? [])
      .flatMap((c) =>
        (c.protocolMappers ?? [])
          .filter((m) => m.name === 'tenant_id')
          .map((m) => ({ clientId: c.clientId, mapper: m })),
      );

    expect(mappers.length).toBeGreaterThan(0);

    for (const { clientId, mapper } of mappers) {
      expect(
        mapper.config?.['user.attribute'],
        `client ${clientId} mapper '${mapper.name}'`,
      ).toBe('tenant_id');
      expect(
        mapper.config?.['claim.name'],
        `client ${clientId} mapper '${mapper.name}'`,
      ).toBe('tenant_id');
    }
  });

  it('seeded demo users carry their tenant_id under the snake_case attribute key', () => {
    const usersWithTenantAttr = (realm.users ?? []).filter((u) => u.attributes?.tenant_id);
    expect(usersWithTenantAttr.length).toBeGreaterThan(0);
    for (const u of usersWithTenantAttr) {
      expect(u.attributes?.tenantId, `user ${u.username} must not use camelCase`).toBeUndefined();
    }
  });
});
