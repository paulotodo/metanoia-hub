import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';

interface KeycloakUserRepresentation {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
}

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  private get baseUrl(): string {
    const url = this.config.get('KEYCLOAK_URL');
    const realm = this.config.get('KEYCLOAK_REALM');
    return `${url}/admin/realms/${realm}`;
  }

  private get tokenUrl(): string {
    const url = this.config.get('KEYCLOAK_URL');
    const realm = this.config.get('KEYCLOAK_REALM');
    return `${url}/realms/${realm}/protocol/openid-connect/token`;
  }

  async getAdminToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const clientId = this.config.get('KEYCLOAK_API_CLIENT_ID');
    const clientSecret = this.config.get('KEYCLOAK_API_CLIENT_SECRET');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error({ status: response.status, body: text }, 'failed to obtain admin token');
      throw new Error(`Keycloak token request failed: ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = data.access_token;
    // Refresh 30s before expiry
    this.tokenExpiresAt = now + (data.expires_in - 30) * 1000;
    return this.cachedToken;
  }

  async createUser(
    email: string,
    password: string,
    name: string,
  ): Promise<{ keycloakId: string }> {
    const token = await this.getAdminToken();
    const [firstName, ...lastParts] = name.split(' ');
    const lastName = lastParts.join(' ') || undefined;

    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        // Realm doesn't enable `registrationEmailAsUsername`, so the username
        // must be set explicitly or Keycloak returns 400 "User name is missing".
        username: email,
        email,
        firstName,
        lastName,
        enabled: true,
        emailVerified: false,
        credentials: [
          {
            type: 'password',
            value: password,
            temporary: false,
          },
        ],
      }),
    });

    if (response.status === 409) {
      throw new KeycloakConflictError('User already exists in Keycloak');
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error({ status: response.status, body: text }, 'failed to create user in keycloak');
      throw new Error(`Keycloak user creation failed: ${response.status}`);
    }

    // Keycloak returns Location header with user ID
    const location = response.headers.get('Location');
    const keycloakId = location?.split('/').pop();

    if (!keycloakId) {
      throw new Error('Keycloak did not return user ID in Location header');
    }

    this.logger.log({ email, keycloakId }, 'user created in keycloak');
    return { keycloakId };
  }

  /**
   * Tenant-aware user creation for the invite/onboarding flow.
   *
   * Two-step Keycloak protocol:
   *  1) POST /users — creates the user with the tenantId attribute but no credential.
   *  2) PUT /users/{id}/reset-password — sets the permanent password separately.
   *
   * This separation matches the plan for Cenário 05 Session 4 and lets us
   * surface password policy failures independently from user creation.
   */
  async createUserForTenant(opts: {
    email: string;
    name: string;
    password: string;
    tenantId: string;
  }): Promise<{ keycloakUserId: string }> {
    const { email, name, password, tenantId } = opts;
    const token = await this.getAdminToken();
    const [firstName, ...lastParts] = name.trim().split(/\s+/);
    const lastName = lastParts.join(' ') || undefined;

    // Step 1 — create user
    const createResponse = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        username: email,
        email,
        firstName,
        lastName,
        enabled: true,
        emailVerified: false,
        attributes: {
          // Must match the Keycloak protocol mapper's `user.attribute`
          // (snake_case) in `infra/keycloak/realm-export.json`. Using camelCase
          // here silently breaks JWT issuance: the attribute is stored on the
          // user profile but the mapper never finds it, so the invited user
          // receives a token without the `tenant_id` claim.
          tenant_id: [tenantId],
        },
      }),
    });

    if (createResponse.status === 409) {
      throw new ConflictException('Este e-mail já possui cadastro.');
    }

    if (!createResponse.ok) {
      const text = await createResponse.text();
      this.logger.error(
        { status: createResponse.status, body: text },
        'failed to create tenant user in keycloak',
      );
      throw new Error(`Keycloak user creation failed: ${createResponse.status}`);
    }

    const location = createResponse.headers.get('Location');
    const keycloakUserId = location?.split('/').pop();

    if (!keycloakUserId) {
      throw new Error('Keycloak did not return user ID in Location header');
    }

    // Step 2 — set password
    const passwordResponse = await fetch(
      `${this.baseUrl}/users/${keycloakUserId}/reset-password`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'password',
          value: password,
          temporary: false,
        }),
      },
    );

    if (!passwordResponse.ok) {
      const text = await passwordResponse.text();
      this.logger.error(
        { status: passwordResponse.status, body: text, keycloakUserId },
        'failed to set password for tenant user in keycloak',
      );
      throw new Error(
        `Keycloak password reset failed: ${passwordResponse.status}`,
      );
    }

    this.logger.log(
      { email, keycloakUserId, tenantId },
      'tenant user created in keycloak',
    );
    return { keycloakUserId };
  }

  async authenticateUser(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
    const clientId = this.config.get('KEYCLOAK_CLIENT_ID');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        username: email,
        password,
      }),
    });

    if (response.status === 401 || response.status === 400) {
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error({ status: response.status, body: text }, 'keycloak authentication failed');
      throw new Error(`Keycloak authentication failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async resetUserPassword(
    keycloakUserId: string,
    newPassword: string,
  ): Promise<void> {
    const token = await this.getAdminToken();

    const response = await fetch(
      `${this.baseUrl}/users/${keycloakUserId}/reset-password`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'password',
          value: newPassword,
          temporary: false,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        { status: response.status, body: text, keycloakUserId },
        'failed to reset user password in keycloak',
      );
      throw new Error(
        `Keycloak password reset failed: ${response.status}`,
      );
    }

    this.logger.log({ keycloakUserId }, 'user password reset in keycloak');
  }

  async findUserByEmail(email: string): Promise<KeycloakUserRepresentation | null> {
    const token = await this.getAdminToken();
    const response = await fetch(
      `${this.baseUrl}/users?email=${encodeURIComponent(email)}&exact=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      this.logger.error({ status: response.status }, 'failed to search user in keycloak');
      throw new Error(`Keycloak user search failed: ${response.status}`);
    }

    const users = (await response.json()) as KeycloakUserRepresentation[];
    return users[0] ?? null;
  }
  /**
   * getUsersByRealmRole — lista todos os usuários Keycloak com um dado realm role.
   *
   * Story 14-4 §FR-007, §Clarifications Q2.
   * Usado pelo IntegrationHealthProcessor para encontrar Super Admins e enviar notificações.
   *
   * @param roleName — valor literal do enum Role (ex: Role.SUPER_ADMIN = 'super_admin').
   *   JSDoc intencional: espera o VALOR do enum, não o nome da constante.
   *   Uso: keycloakAdminService.getUsersByRealmRole(Role.SUPER_ADMIN)
   *
   * @returns Array de KeycloakUserRepresentation. Retorna [] se role não encontrada (404)
   *   ou se não houver usuários com o role.
   */
  async getUsersByRealmRole(roleName: string): Promise<KeycloakUserRepresentation[]> {
    const token = await this.getAdminToken();

    const response = await fetch(
      `${this.baseUrl}/roles/${encodeURIComponent(roleName)}/users`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    );

    // 404 = role inexistente → array vazio (comportamento defensivo)
    if (response.status === 404) {
      this.logger.warn({ roleName }, 'keycloak_role_not_found');
      return [];
    }

    if (!response.ok) {
      this.logger.error(
        { status: response.status, roleName },
        'failed to fetch users by realm role',
      );
      throw new Error(`Keycloak role users fetch failed: ${response.status}`);
    }

    const users = (await response.json()) as KeycloakUserRepresentation[];
    return users;
  }

}

export class KeycloakConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeycloakConflictError';
  }
}
