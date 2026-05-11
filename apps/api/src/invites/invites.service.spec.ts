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
  kind: 'pre_tenant_signup',
  inviteeRole: null,
  groupId: null,
  revokedAt: null,
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

  // --- resolveToken: discriminated /resolve endpoint (Story 7-5) ---

  it('resolveToken returns invalid when token not found', async () => {
    mocks.repository.findByToken.mockResolvedValue(null);
    const result = await mocks.service.resolveToken('missing');
    expect(result).toEqual({ status: 'invalid', invite: null });
  });

  it('resolveToken returns used when usedAt is not null', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      usedAt: new Date(),
    });
    const result = await mocks.service.resolveToken('tok-used');
    expect(result).toEqual({ status: 'used', invite: null });
  });

  it('resolveToken returns expired when expiresAt is in the past', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await mocks.service.resolveToken('tok-exp');
    expect(result).toEqual({ status: 'expired', invite: null });
  });

  it('resolveToken returns invalid when invite is revoked', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      revokedAt: new Date(),
    });
    const result = await mocks.service.resolveToken('tok-revoked');
    expect(result).toEqual({ status: 'invalid', invite: null });
  });

  it('resolveToken maps pre_tenant_signup -> admin-tenant kind', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      tenantId: '01912345-6789-7000-8000-000000000bbb',
    });
    const result = await mocks.service.resolveToken('tok-admin');
    expect(result.status).toBe('valid');
    expect(result.invite).toEqual({
      kind: 'admin-tenant',
      leader: { name: 'Pastor Paulo', email: 'pastor@example.com' },
      tenant: {
        id: '01912345-6789-7000-8000-000000000bbb',
        name: 'Igreja Exemplo',
      },
    });
  });

  it('resolveToken maps group_member -> participant with group + leader lookup', async () => {
    const tenantId = '01912345-6789-7000-8000-000000000ccc';
    const groupId = '01912345-6789-7000-8000-000000000ddd';
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      kind: 'group_member',
      tenantId,
      groupId,
      churchName: null,
    });
    mocks.prisma.client.$transaction.mockImplementationOnce(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          group: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: groupId, name: 'Fundamentos da Fé' }),
          },
          tenant: {
            findUnique: vi
              .fn()
              .mockResolvedValue({ id: tenantId, name: 'Igreja Demo' }),
          },
          groupMember: {
            findFirst: vi.fn().mockResolvedValue({
              role: 'lider',
              user: { name: 'Marcos Silva' },
            }),
          },
        };
        return fn(tx);
      },
    );

    const result = await mocks.service.resolveToken('tok-part');
    expect(result.status).toBe('valid');
    expect(result.invite).toEqual({
      kind: 'participant',
      leader: { firstName: 'Marcos', avatarUrl: null },
      tenant: { id: tenantId, name: 'Igreja Demo' },
      group: { id: groupId, name: 'Fundamentos da Fé' },
    });
  });

  it('resolveToken returns invalid for group_member when group not found', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      kind: 'group_member',
      tenantId: '01912345-6789-7000-8000-000000000ccc',
      groupId: '01912345-6789-7000-8000-000000000ddd',
    });
    mocks.prisma.client.$transaction.mockImplementationOnce(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          group: { findFirst: vi.fn().mockResolvedValue(null) },
          tenant: { findUnique: vi.fn().mockResolvedValue(null) },
          groupMember: { findFirst: vi.fn().mockResolvedValue(null) },
        };
        return fn(tx);
      },
    );
    const result = await mocks.service.resolveToken('tok-orphan');
    expect(result).toEqual({ status: 'invalid', invite: null });
  });

  it('resolveToken falls through to invalid for unsupported kinds', async () => {
    mocks.repository.findByToken.mockResolvedValue({
      ...validInvite,
      kind: 'tenant_leader',
    });
    const result = await mocks.service.resolveToken('tok-leader');
    expect(result).toEqual({ status: 'invalid', invite: null });
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
