import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsService } from './reports.service';
import { Role } from '../auth/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { LeaderSummaryQuery } from '@metanoia/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQueue = { add: vi.fn() };
const mockBullMqService = { createQueue: vi.fn(() => mockQueue), createWorker: vi.fn() };
const mockRedis = { get: vi.fn(), set: vi.fn() };
const mockStorage = { getSignedUrl: vi.fn(), upload: vi.fn() };

vi.mock('../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({ tenantId: 'tenant-001', userId: 'user-lider-01' })),
}));

const mockTx = {
  group: { findMany: vi.fn() },
  groupMember: { findMany: vi.fn() },
  participantRadarStatus: { findMany: vi.fn() },
  meeting: { findMany: vi.fn() },
  meetingAttendance: { findMany: vi.fn() },
  trailProgress: { findMany: vi.fn() },
};

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(
    (_prisma: unknown, fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  ),
}));

const mockPrisma = {};

// ─── Users ────────────────────────────────────────────────────────────────────

const adminUser: AuthenticatedUser = {
  userId: 'user-admin-01',
  tenantId: 'tenant-001',
  roles: [Role.ADMIN_TENANT],
  email: 'admin@church.com',
};

const liderUser: AuthenticatedUser = {
  userId: 'user-lider-01',
  tenantId: 'tenant-001',
  roles: [Role.LIDER],
  email: 'lider@church.com',
};

const liderB: AuthenticatedUser = {
  userId: 'user-lider-02',
  tenantId: 'tenant-001',
  roles: [Role.LIDER],
  email: 'liderB@church.com',
};

const defaultQuery: LeaderSummaryQuery = { period: '30d' };

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(): ReportsService {
  const svc = new ReportsService(
    mockBullMqService as never,
    mockPrisma as never,
    mockRedis as never,
    mockStorage as never,
  );
  // Suppress onModuleInit queue setup
  vi.spyOn(svc, 'onModuleInit').mockReturnValue(undefined);
  return svc;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReportsService.getLeaderSummary', () => {
  let service: ReportsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
  });

  it('lider with no groups returns empty groups[] and zeroed summary (200, no throw)', async () => {
    // resolveLeaderGroupUniverse: empty memberships
    mockTx.groupMember.findMany.mockResolvedValueOnce([]);

    const result = await service.getLeaderSummary(defaultQuery, liderUser);

    expect(result.data.groups).toEqual([]);
    expect(result.data.summary.totalGroups).toBe(0);
    expect(result.data.summary.totalParticipants).toBe(0);
    expect(result.data.summary.overallAttendancePercent).toBeNull();
  });

  it('lider with 2 groups returns both groups and correct summary', async () => {
    // resolveLeaderGroupUniverse: 2 lider groups
    mockTx.groupMember.findMany.mockResolvedValueOnce([
      { groupId: 'group-001', group: { id: 'group-001', name: 'Células Norte' } },
      { groupId: 'group-002', group: { id: 'group-002', name: 'Células Sul' } },
    ]);

    // For each group (2 calls): active members, radar, meetings, trailProgress
    // Group 001 metrics
    mockTx.groupMember.findMany.mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }]);
    mockTx.participantRadarStatus.findMany.mockResolvedValueOnce([{ participantId: 'u1' }]);
    mockTx.meeting.findMany.mockResolvedValueOnce([]);
    mockTx.trailProgress.findMany.mockResolvedValueOnce([]);
    // Group 002 metrics
    mockTx.groupMember.findMany.mockResolvedValueOnce([{ userId: 'u3' }]);
    mockTx.participantRadarStatus.findMany.mockResolvedValueOnce([]);
    mockTx.meeting.findMany.mockResolvedValueOnce([]);
    mockTx.trailProgress.findMany.mockResolvedValueOnce([]);

    const result = await service.getLeaderSummary(defaultQuery, liderUser);

    expect(result.data.groups).toHaveLength(2);
    expect(result.data.groups[0].groupName).toBe('Células Norte');
    expect(result.data.groups[0].atRiskCount).toBe(1);
    expect(result.data.groups[1].atRiskCount).toBe(0);
    expect(result.data.summary.totalGroups).toBe(2);
    expect(result.data.summary.totalParticipants).toBe(3); // 2 + 1
  });

  it('BOLA: lider A requests groupId from lider B universe → groups: [], 200 (no 403)', async () => {
    // lider B's universe: group-002 only
    mockTx.groupMember.findMany.mockResolvedValueOnce([
      { groupId: 'group-002', group: { id: 'group-002', name: 'Células Sul' } },
    ]);

    // Request with groupId=group-999 (not in liderB's universe)
    const result = await service.getLeaderSummary(
      { period: '30d', groupId: 'group-999' },
      liderB,
    );

    expect(result.data.groups).toEqual([]);
    expect(result.data.summary.totalGroups).toBe(0);
    // Must NOT throw — no 403
  });

  it('admin sees all groups in tenant', async () => {
    // admin: resolveLeaderGroupUniverse uses group.findMany (no membership filter)
    mockTx.group.findMany.mockResolvedValueOnce([
      { id: 'g1', name: 'Grupo Admin 1' },
      { id: 'g2', name: 'Grupo Admin 2' },
    ]);
    // For each group compute metrics
    mockTx.groupMember.findMany.mockResolvedValue([]);
    mockTx.participantRadarStatus.findMany.mockResolvedValue([]);
    mockTx.meeting.findMany.mockResolvedValue([]);
    mockTx.trailProgress.findMany.mockResolvedValue([]);

    const result = await service.getLeaderSummary(defaultQuery, adminUser);

    expect(result.data.groups).toHaveLength(2);
    expect(result.data.summary.totalGroups).toBe(2);
  });

  it('avgAttendancePercent is null when no meetings in period', async () => {
    mockTx.groupMember.findMany.mockResolvedValueOnce([
      { groupId: 'g1', group: { id: 'g1', name: 'Grupo Sem Reunião' } },
    ]);
    mockTx.groupMember.findMany.mockResolvedValueOnce([{ userId: 'u1' }]);
    mockTx.participantRadarStatus.findMany.mockResolvedValueOnce([]);
    mockTx.meeting.findMany.mockResolvedValueOnce([]); // no meetings
    mockTx.trailProgress.findMany.mockResolvedValueOnce([]);

    const result = await service.getLeaderSummary(defaultQuery, liderUser);

    expect(result.data.groups[0].avgAttendancePercent).toBeNull();
    expect(result.data.summary.overallAttendancePercent).toBeNull();
  });

  it('returns correct meta with period and date range', async () => {
    mockTx.groupMember.findMany.mockResolvedValueOnce([]);

    const result = await service.getLeaderSummary({ period: '7d' }, liderUser);

    expect(result.meta.period).toBe('7d');
    expect(result.meta.startDate).toBeTruthy();
    expect(result.meta.endDate).toBeTruthy();
  });
});
