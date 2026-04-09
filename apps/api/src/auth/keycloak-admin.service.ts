import { Injectable, Logger } from '@nestjs/common';
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
}

export class KeycloakConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeycloakConflictError';
  }
}
