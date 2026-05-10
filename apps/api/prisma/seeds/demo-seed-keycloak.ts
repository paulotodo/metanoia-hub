/**
 * Story 7-4 — Provision the Story 7-2 demo users into Keycloak.
 *
 * The demo Postgres seed (`db:seed:demo`) inserts users into our app DB but
 * does NOT touch Keycloak. The E2E happy-path spec needs to log in with real
 * credentials, so this script ensures the same users exist in the realm with
 * a deterministic password and the matching realm role.
 *
 * Idempotent: re-runs lookup by email and PUT reset-password rather than
 * recreating; safe to invoke after every `db:seed:demo`.
 *
 * Auth strategy: master realm admin user (`KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`)
 * via password grant on `master/admin-cli`. Uses the master credentials, not the
 * realm's API client, because seeding runs ahead of any service-account setup.
 *
 * Usage: pnpm --filter @metanoia/api db:seed:demo:keycloak
 */

import { DEMO_TENANT_ID, DEMO_USERS, type DemoRole } from './demo-seed';

// docker-compose exposes the master admin via `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD`.
// `KEYCLOAK_ADMIN_USER` is also accepted for parity with other tooling.
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'metanoia';
const KEYCLOAK_ADMIN_USER =
  process.env.KEYCLOAK_ADMIN_USER ?? process.env.KEYCLOAK_ADMIN ?? 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin';
const E2E_DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'Demo!Pass2026';

const adminBase = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}`;
const masterTokenUrl = `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`;

interface KeycloakUser {
  id: string;
  email: string;
  username?: string;
  enabled?: boolean;
}

interface RealmRole {
  id: string;
  name: string;
}

async function getAdminToken(): Promise<string> {
  const response = await fetch(masterTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: KEYCLOAK_ADMIN_USER,
      password: KEYCLOAK_ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to authenticate as Keycloak admin (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function findUserByEmail(token: string, email: string): Promise<KeycloakUser | null> {
  const response = await fetch(
    `${adminBase}/users?email=${encodeURIComponent(email)}&exact=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    throw new Error(`Failed to search Keycloak user ${email}: ${response.status}`);
  }

  const users = (await response.json()) as KeycloakUser[];
  return users[0] ?? null;
}

async function createUser(
  token: string,
  user: { id: string; email: string; name: string },
): Promise<string> {
  const [firstName, ...rest] = user.name.trim().split(/\s+/);
  const lastName = rest.join(' ') || undefined;

  const response = await fetch(`${adminBase}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: user.email,
      email: user.email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: true,
      // Realm protocol mapper reads user attribute `tenant_id` (snake_case)
      // and emits it as JWT claim `tenant_id`. KeycloakAuthGuard requires it
      // — without it every authenticated request returns 401.
      attributes: { tenant_id: [DEMO_TENANT_ID] },
      credentials: [{ type: 'password', value: E2E_DEMO_PASSWORD, temporary: false }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to create Keycloak user ${user.email} (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const location = response.headers.get('Location');
  const keycloakId = location?.split('/').pop();
  if (!keycloakId) {
    throw new Error(`Keycloak did not return an id when creating ${user.email}`);
  }
  return keycloakId;
}

async function resetPassword(token: string, keycloakId: string): Promise<void> {
  const response = await fetch(`${adminBase}/users/${keycloakId}/reset-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: 'password', value: E2E_DEMO_PASSWORD, temporary: false }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to reset password for ${keycloakId} (${response.status}): ${body.slice(0, 200)}`,
    );
  }
}

async function getRealmRole(token: string, name: string): Promise<RealmRole> {
  const response = await fetch(`${adminBase}/roles/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Realm role "${name}" not found in realm ${KEYCLOAK_REALM} (${response.status}). ` +
        `Make sure infra/keycloak/realm-export.json was imported.`,
    );
  }

  return (await response.json()) as RealmRole;
}

async function ensureRealmRole(
  token: string,
  keycloakId: string,
  role: DemoRole,
): Promise<void> {
  const realmRole = await getRealmRole(token, role);

  const response = await fetch(`${adminBase}/users/${keycloakId}/role-mappings/realm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify([{ id: realmRole.id, name: realmRole.name }]),
  });

  // 204 No Content on success; 409 means the mapping already exists — both fine.
  if (!response.ok && response.status !== 409) {
    const body = await response.text();
    throw new Error(
      `Failed to assign realm role ${role} to ${keycloakId} (${response.status}): ${body.slice(0, 200)}`,
    );
  }
}

interface KeycloakClient {
  id: string;
  clientId: string;
}

interface ClientRole {
  id: string;
  name: string;
}

async function findClient(token: string, clientId: string): Promise<KeycloakClient> {
  const response = await fetch(
    `${adminBase}/clients?clientId=${encodeURIComponent(clientId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`Failed to look up client "${clientId}": ${response.status}`);
  }
  const clients = (await response.json()) as KeycloakClient[];
  const client = clients[0];
  if (!client) {
    throw new Error(
      `Client "${clientId}" not found in realm ${KEYCLOAK_REALM}. ` +
        `Make sure infra/keycloak/realm-export.json was imported.`,
    );
  }
  return client;
}

async function getClientRole(
  token: string,
  clientUuid: string,
  roleName: string,
): Promise<ClientRole> {
  const response = await fetch(
    `${adminBase}/clients/${clientUuid}/roles/${encodeURIComponent(roleName)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(
      `Client role "${roleName}" not found on client ${clientUuid}: ${response.status}`,
    );
  }
  return (await response.json()) as ClientRole;
}

async function getServiceAccountUserId(token: string, clientUuid: string): Promise<string> {
  const response = await fetch(
    `${adminBase}/clients/${clientUuid}/service-account-user`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(
      `Service account user for client ${clientUuid} not found (${response.status}). ` +
        `Confirm serviceAccountsEnabled=true on the client.`,
    );
  }
  const user = (await response.json()) as { id: string };
  return user.id;
}

async function ensureServiceAccountClientRoles(
  token: string,
  serviceAccountUserId: string,
  realmMgmtUuid: string,
  roleNames: string[],
): Promise<void> {
  const roles = await Promise.all(
    roleNames.map((name) => getClientRole(token, realmMgmtUuid, name)),
  );

  const response = await fetch(
    `${adminBase}/users/${serviceAccountUserId}/role-mappings/clients/${realmMgmtUuid}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(roles.map((r) => ({ id: r.id, name: r.name }))),
    },
  );

  if (!response.ok && response.status !== 409) {
    const body = await response.text();
    throw new Error(
      `Failed to grant ${roleNames.join(',')} to service account (${response.status}): ${body.slice(0, 200)}`,
    );
  }
}

/**
 * Without these mappings the API client (`metanoia-api`) cannot create or
 * search Keycloak users, so the registration flow returns 500 ("An unexpected
 * error occurred") and login lookups fail. Idempotent — Keycloak silently
 * ignores roles already present.
 */
async function provisionApiServiceAccount(token: string): Promise<void> {
  const apiClient = await findClient(token, 'metanoia-api');
  const realmMgmt = await findClient(token, 'realm-management');
  const saUserId = await getServiceAccountUserId(token, apiClient.id);
  await ensureServiceAccountClientRoles(token, saUserId, realmMgmt.id, [
    'manage-users',
    'view-users',
    'query-users',
  ]);
  console.log(
    `  - service-account-metanoia-api → manage-users + view-users + query-users (realm-management)`,
  );
}

async function main() {
  console.log(
    `Provisioning ${DEMO_USERS.length} demo users into Keycloak realm "${KEYCLOAK_REALM}" at ${KEYCLOAK_URL}...`,
  );

  let token: string;
  try {
    token = await getAdminToken();
  } catch (error) {
    console.error('[demo-seed-keycloak] admin login failed:', (error as Error).message);
    process.exit(1);
  }

  // Pre-step: ensure the API client can manage realm users.
  // Without this the register flow fails with 500 because the realm export
  // doesn't ship with service-account role mappings.
  await provisionApiServiceAccount(token);

  let created = 0;
  let updated = 0;

  for (const user of DEMO_USERS) {
    const existing = await findUserByEmail(token, user.email);
    let keycloakId: string;

    if (existing) {
      keycloakId = existing.id;
      await resetPassword(token, keycloakId);
      updated += 1;
    } else {
      keycloakId = await createUser(token, user);
      created += 1;
    }

    await ensureRealmRole(token, keycloakId, user.role);
    console.log(`  - ${user.email} [${user.role}] → ${existing ? 'updated' : 'created'} (${keycloakId})`);
  }

  console.log(
    `\nDemo Keycloak seed concluído: ${created} criados, ${updated} atualizados (senha = E2E_DEMO_PASSWORD).`,
  );
}

main().catch((error) => {
  console.error('[demo-seed-keycloak] fatal:', error);
  process.exit(1);
});
