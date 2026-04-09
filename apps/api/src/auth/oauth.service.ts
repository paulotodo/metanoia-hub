import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateId } from '@metanoia/types';
import type { EnvConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token: string;
}

interface IdTokenPayload {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
}

interface OAuthCallbackResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  hasConsent: boolean;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  getGoogleRedirectUrl(callbackUrl: string): string {
    const keycloakUrl = this.config.get('KEYCLOAK_URL');
    const realm = this.config.get('KEYCLOAK_REALM');
    const clientId = this.config.get('KEYCLOAK_CLIENT_ID');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      kc_idp_hint: 'google',
    });

    return `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    callbackUrl: string,
    metadata: { ipAddress: string; userAgent: string },
  ): Promise<OAuthCallbackResult> {
    // 1. Exchange authorization code for tokens
    const tokens = await this.exchangeCode(code, callbackUrl);

    // 2. Decode ID token to get user info
    const userInfo = this.decodeIdToken(tokens.id_token);

    // 3. Upsert user in PostgreSQL
    const user = await this.upsertUser(userInfo);

    // 4. Check LGPD consent
    const consents = await this.prisma.client.consent.findMany({
      where: { userId: user.id, documentType: 'terms_of_service' },
      take: 1,
    });

    // 5. Create session
    const sessionId = await this.sessionService.create(user.id, tokens.expires_in, metadata);

    this.logger.log(
      { userId: user.id, email: userInfo.email, action: 'auth.oauth.success' },
      'google oauth login successful',
    );

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      sessionId,
      hasConsent: consents.length > 0,
    };
  }

  private async exchangeCode(code: string, callbackUrl: string): Promise<OAuthTokenResponse> {
    const keycloakUrl = this.config.get('KEYCLOAK_URL');
    const realm = this.config.get('KEYCLOAK_REALM');
    const clientId = this.config.get('KEYCLOAK_CLIENT_ID');
    const tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error({ status: response.status, body: text }, 'oauth code exchange failed');
      throw new Error(`OAuth code exchange failed: ${response.status}`);
    }

    return (await response.json()) as OAuthTokenResponse;
  }

  private decodeIdToken(idToken: string): IdTokenPayload {
    const parts = idToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload as IdTokenPayload;
  }

  private async upsertUser(userInfo: IdTokenPayload) {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: userInfo.email },
    });

    if (existing) {
      return existing;
    }

    const name = userInfo.name
      ?? [userInfo.given_name, userInfo.family_name].filter(Boolean).join(' ')
      ?? userInfo.email;

    const userId = generateId();
    const user = await this.prisma.client.user.create({
      data: {
        id: userId,
        email: userInfo.email,
        name,
        status: 'active', // Google already verified email
        tenantId: null,
      },
    });

    this.logger.log(
      { userId, email: userInfo.email, action: 'auth.oauth.user_created' },
      'new user created via google oauth',
    );

    return user;
  }
}
