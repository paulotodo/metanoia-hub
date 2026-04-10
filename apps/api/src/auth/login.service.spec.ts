import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginService } from './login.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import { SessionService } from './session.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LoginService', () => {
  let service: LoginService;
  let keycloakAdmin: { authenticateUser: ReturnType<typeof vi.fn> };
  let sessionService: { create: ReturnType<typeof vi.fn> };
  let prisma: { client: { user: { findUnique: ReturnType<typeof vi.fn> } } };

  const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(async () => {
    keycloakAdmin = { authenticateUser: vi.fn() };
    sessionService = { create: vi.fn() };
    prisma = {
      client: {
        user: { findUnique: vi.fn() },
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LoginService,
        { provide: KeycloakAdminService, useValue: keycloakAdmin },
        { provide: SessionService, useValue: sessionService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LoginService);
  });

  it('should return login response on valid credentials', async () => {
    keycloakAdmin.authenticateUser.mockResolvedValue({
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });

    prisma.client.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      name: 'John Doe',
      userTenants: [{ tenantId: 'tenant-1', role: 'participante' }],
      consents: [{ documentType: 'terms_of_service' }],
    });

    sessionService.create.mockResolvedValue('session-id');

    const result = await service.login(
      { email: 'user@example.com', password: 'validPassword123!' },
      metadata,
    );

    expect(result.accessToken).toBe('jwt-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.sessionId).toBe('session-id');
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.hasConsent).toBe(true);
    expect(result.user.tenants).toHaveLength(1);
  });

  it('should throw UnauthorizedException on invalid credentials', async () => {
    keycloakAdmin.authenticateUser.mockResolvedValue(null);

    await expect(
      service.login(
        { email: 'user@example.com', password: 'wrongPassword' },
        metadata,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when user not found in database', async () => {
    keycloakAdmin.authenticateUser.mockResolvedValue({
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });

    prisma.client.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login(
        { email: 'ghost@example.com', password: 'validPassword123!' },
        metadata,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should set hasConsent to false when no consent records exist', async () => {
    keycloakAdmin.authenticateUser.mockResolvedValue({
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });

    prisma.client.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      name: 'John Doe',
      userTenants: [],
      consents: [],
    });

    sessionService.create.mockResolvedValue('session-id');

    const result = await service.login(
      { email: 'user@example.com', password: 'validPassword123!' },
      metadata,
    );

    expect(result.user.hasConsent).toBe(false);
  });
});
