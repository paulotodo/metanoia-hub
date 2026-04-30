import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface AuthExecution {
  authenticator?: string;
  requirement: string;
  flowAlias?: string;
  authenticatorConfig?: string;
}
interface AuthFlow {
  alias: string;
  topLevel: boolean;
  authenticationExecutions: AuthExecution[];
}
interface AuthConfig {
  alias: string;
  config: Record<string, string>;
}
interface RealmExport {
  realm: string;
  browserFlow?: string;
  otpPolicyType?: string;
  otpPolicyDigits?: number;
  authenticationFlows?: AuthFlow[];
  authenticatorConfig?: AuthConfig[];
  users?: Array<{ realmRoles?: string[]; requiredActions?: string[]; username: string }>;
}

const realm = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', '..', 'infra', 'keycloak', 'realm-export.json'),
    'utf8',
  ),
) as RealmExport;

/**
 * Story 2-3 — MFA Obrigatório para Super Admin e Admin Tenant.
 *
 * Validates the realm-export.json carries the conditional auth flow that
 * forces TOTP for the two privileged roles. These tests are pure JSON
 * checks; they don't talk to a running Keycloak.
 */
describe('Keycloak realm — Story 2-3 MFA enforcement', () => {
  it('declares TOTP as the OTP policy', () => {
    expect(realm.otpPolicyType).toBe('totp');
    expect(realm.otpPolicyDigits).toBe(6);
  });

  it('uses the custom browserFlow that enforces conditional MFA', () => {
    expect(realm.browserFlow).toBe('metanoia browser');
  });

  it('contains the top-level "metanoia browser" flow', () => {
    const top = realm.authenticationFlows?.find(
      (f) => f.alias === 'metanoia browser',
    );
    expect(top).toBeDefined();
    expect(top?.topLevel).toBe(true);
  });

  it.each([
    ['super_admin', 'metanoia conditional otp super_admin', 'metanoia-mfa-cfg-super-admin'],
    ['admin_tenant', 'metanoia conditional otp admin_tenant', 'metanoia-mfa-cfg-admin-tenant'],
  ])('configures conditional OTP for role %s', (role, flowAlias, cfgAlias) => {
    const flow = realm.authenticationFlows?.find((f) => f.alias === flowAlias);
    expect(flow, `missing flow ${flowAlias}`).toBeDefined();

    const cond = flow?.authenticationExecutions.find(
      (e) => e.authenticator === 'conditional-user-role',
    );
    expect(cond?.authenticatorConfig).toBe(cfgAlias);

    const otp = flow?.authenticationExecutions.find(
      (e) => e.authenticator === 'auth-otp-form',
    );
    expect(otp?.requirement).toBe('REQUIRED');

    const cfg = realm.authenticatorConfig?.find((c) => c.alias === cfgAlias);
    expect(cfg?.config.condUserRole).toBe(role);
  });

  it.each(['super_admin', 'admin_tenant'])(
    'seed user with role %s has CONFIGURE_TOTP required action on first login',
    (role) => {
      const user = realm.users?.find((u) => u.realmRoles?.includes(role));
      expect(user, `seed user with role ${role} not found`).toBeDefined();
      expect(user?.requiredActions ?? []).toContain('CONFIGURE_TOTP');
    },
  );

  it.each(['lider', 'participante'])(
    'seed user with role %s does NOT require TOTP setup (not yet)',
    (role) => {
      const user = realm.users?.find((u) => u.realmRoles?.includes(role));
      expect(user, `seed user with role ${role} not found`).toBeDefined();
      expect(user?.requiredActions ?? []).not.toContain('CONFIGURE_TOTP');
    },
  );
});
