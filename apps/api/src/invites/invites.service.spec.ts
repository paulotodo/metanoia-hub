import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { InvitesService } from './invites.service';

function createMocks() {
  const repository = {
    findByToken: vi.fn(),
    markTermsAccepted: vi.fn().mockResolvedValue(undefined),
    markUsed: vi.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    client: {
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          tenant: { create: vi.fn().mockResolvedValue({}) },
          user: { create: vi.fn().mockResolvedValue({}) },
          userTenant: { create: vi.fn().mockResolvedValue({}) },
          consent: { create: vi.fn().mockResolvedValue({}) },
          invite: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      }),
    },
  };

  const keycloakAdmin = {
    createUserForTenant: vi.fn().mockResolvedValue({ keycloakId: 'kc-id' }),
    authenticateUser: vi
      .fn()
      .mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
  };

  const service = new InvitesService(
    repository as any,
    prisma as any,
    keycloakAdmin as any,
  );

  return { service, repository, prisma, keycloakAdmin };
}

const validInvite = {
  id: '01912345-6789-7000-8000-000000000aaa',
  token: 'tok-abc',
  tenantId: null,
  leaderName: 'Pastor Paulo',
  leaderEmail: 'pastor@example.com',
  churchName: 'Igreja Exemplo',
  expiresAt: new Date(Date.now() + 86_400_000),
  usedAt: null,
  termsAcceptedAt: null,
  createdAt: new Date(),
};

describe('InvitesService', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it('validateToken returns invalid when token not found', async () => {
    mocks.repository.findByToken.mockResolvedValue(null);

    const result = await mocks.service.validateToken('missing');

    expect(result).toEqual({ status: 'invalid', tenant: null });
  });

  it('validateToken returns used when usedAt is not null', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      usedAt: new Date(),
    });

    const result = await mocks.service.validateToken('tok-used');

    expect(result.status).toBe('used');
  });

  it('validateToken returns expired when expiresAt is in the past', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await mocks.service.validateToken('tok-exp');

    expect(result.status).toBe('expired');
  });

  it('validateToken returns valid with leader + tenant preview for an existing tenant', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      tenantId: '01912345-6789-7000-8000-000000000bbb',
    });

    const result = await mocks.service.validateToken('tok-ok');

    expect(result.status).toBe('valid');
    expect(result).toMatchObject({
      leader: { name: 'Pastor Paulo', email: 'pastor@example.com' },
      tenant: {
        id: '01912345-6789-7000-8000-000000000bbb',
        name: 'Igreja Exemplo',
      },
    });
  });

  it('acceptTerms marks terms accepted and returns ISO timestamp', async () => {
    mocks.repository.findByToken.mockResolvedValue(validInvite);

    const result = await mocks.service.acceptTerms('tok-ok', {
      termsVersion: 'v1',
    } as any);

    expect(mocks.repository.markTermsAccepted).toHaveBeenCalledWith(
      validInvite.id,
      'v1',
    );
    expect(() => new Date(result.acceptedAt).toISOString()).not.toThrow();
  });

  it('createAccount propagates ConflictException from Keycloak and does not run the transaction', async () => {
    mocks.repository.findByToken.mockResolvedValue(validInvite);
    mocks.keycloakAdmin.createUserForTenant.mockRejectedValue(
      new ConflictException('User already exists'),
    );

    await expect(
      mocks.service.createAccount('tok-ok', {
        email: 'new@example.com',
        password: 'p@ssw0rd123',
        name: 'New User',
        churchName: 'New Church',
      } as any),
    ).rejects.toThrow(ConflictException);

    expect(mocks.prisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('createAccount throws BadRequest if post-create authentication fails', async () => {
    mocks.repository.findByToken.mockResolvedValue(validInvite);
    mocks.keycloakAdmin.authenticateUser.mockResolvedValue(null);

    await expect(
      mocks.service.createAccount('tok-ok', {
        email: 'new@example.com',
        password: 'p@ssw0rd123',
        name: 'New User',
        churchName: 'New Church',
      } as any),
    ).rejects.toThrow(BadRequestException);

    expect(mocks.keycloakAdmin.createUserForTenant).toHaveBeenCalledOnce();
    expect(mocks.prisma.client.$transaction).toHaveBeenCalledOnce();
  });
});
