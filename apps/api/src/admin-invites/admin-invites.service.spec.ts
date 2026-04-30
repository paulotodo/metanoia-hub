import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { AdminInvitesService } from './admin-invites.service';
import { requestContext } from '../common/context/request-context';

const TENANT = '01912345-6789-7000-8000-000000000001';
const USER = '01912345-6789-7000-8000-0000000000a1';

function buildInviteRow(overrides: Partial<{ id: string; kind: string; revokedAt: Date | null; usedAt: Date | null; expiresAt: Date }> = {}) {
  return {
    id: overrides.id ?? generateId(),
    token: 'tok_test',
    tenantId: TENANT,
    leaderName: 'Maria',
    leaderEmail: 'maria@tenant.org',
    churchName: null,
    kind: overrides.kind ?? 'tenant_member',
    inviteeRole: 'participante',
    groupId: null,
    revokedAt: overrides.revokedAt ?? null,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    usedAt: overrides.usedAt ?? null,
    termsAcceptedAt: null,
    createdAt: new Date('2026-04-30T08:00:00.000Z'),
  };
}

function createMocks() {
  const repo = {
    create: vi.fn(),
    listForTenant: vi.fn(),
    findById: vi.fn(),
    revoke: vi.fn(),
    findActiveByEmail: vi.fn().mockResolvedValue(null),
  };
  const config = {
    get: vi.fn().mockReturnValue('http://localhost:3000'),
  };
  const service = new AdminInvitesService(repo as never, config as never);
  return { service, repo, config };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT,
      userId: USER,
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('AdminInvitesService.create', () => {
  let mocks: ReturnType<typeof createMocks>;
  beforeEach(() => {
    mocks = createMocks();
  });

  it('creates a tenant_member invite with URL', async () => {
    mocks.repo.create.mockResolvedValue(buildInviteRow({ kind: 'tenant_member' }));
    const result = await withCtx(() =>
      mocks.service.create({
        inviteeEmail: 'maria@tenant.org',
        inviteeName: 'Maria',
        kind: 'tenant_member',
        expiresInDays: 7,
      }),
    );
    expect(result.data.invite.kind).toBe('tenant_member');
    expect(result.data.invite.status).toBe('pending');
    expect(result.data.inviteUrl).toMatch(/^http:\/\/localhost:3000\/convite\//);
  });

  it('rejects when active invite already exists for the email', async () => {
    mocks.repo.findActiveByEmail.mockResolvedValue(buildInviteRow());
    await expect(
      withCtx(() =>
        mocks.service.create({
          inviteeEmail: 'maria@tenant.org',
          inviteeName: 'Maria',
          kind: 'tenant_member',
          expiresInDays: 7,
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AdminInvitesService.list', () => {
  it('returns array with computed status (pending, expired, revoked, accepted)', async () => {
    const { service, repo } = createMocks();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    repo.listForTenant.mockResolvedValue([
      buildInviteRow({ kind: 'tenant_member' }), // pending
      buildInviteRow({ kind: 'group_leader', expiresAt: past }), // expired
      buildInviteRow({ kind: 'tenant_leader', revokedAt: new Date() }), // revoked
      buildInviteRow({ kind: 'tenant_member', usedAt: new Date() }), // accepted
    ]);
    const result = await withCtx(() => service.list());
    expect(result.data.map((i) => i.status)).toEqual([
      'pending',
      'expired',
      'revoked',
      'accepted',
    ]);
    expect(result.meta.total).toBe(4);
  });
});

describe('AdminInvitesService.revoke', () => {
  it('revokes a pending invite', async () => {
    const { service, repo } = createMocks();
    const id = generateId();
    repo.findById.mockResolvedValue(buildInviteRow({ id }));
    repo.revoke.mockResolvedValue(
      buildInviteRow({ id, revokedAt: new Date() }),
    );
    const result = await withCtx(() => service.revoke(id));
    expect(result.data.status).toBe('revoked');
  });

  it('is idempotent on already-revoked invites', async () => {
    const { service, repo } = createMocks();
    const id = generateId();
    repo.findById.mockResolvedValue(
      buildInviteRow({ id, revokedAt: new Date() }),
    );
    const result = await withCtx(() => service.revoke(id));
    expect(result.data.status).toBe('revoked');
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it('refuses to revoke an already-used invite', async () => {
    const { service, repo } = createMocks();
    const id = generateId();
    repo.findById.mockResolvedValue(
      buildInviteRow({ id, usedAt: new Date() }),
    );
    await expect(
      withCtx(() => service.revoke(id)),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws 404 when invite missing', async () => {
    const { service, repo } = createMocks();
    repo.findById.mockResolvedValue(null);
    await expect(
      withCtx(() => service.revoke('019800a0-0000-7000-8000-000000000099')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
