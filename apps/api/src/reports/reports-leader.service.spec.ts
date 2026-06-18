import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { BullMqService } from '../bullmq/bullmq.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { Role } from '../auth/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { LeaderSummaryQuery } from '@metanoia/types';

// Mock getRequestContext
jest.mock('../common/context/request-context', () => ({
  getRequestContext: () => ({ tenantId: 'tenant-001' }),
}));

// Mock withTenantTx to pass-through
jest.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: (_prisma: unknown, fn: (tx: unknown) => unknown) => fn(mockTx),
}));

const mockTx = {
  group: { findMany: jest.fn() },
  groupMember: { findMany: jest.fn() },
  participantRadarStatus: { findMany: jest.fn() },
  meeting: { findMany: jest.fn() },
  meetingAttendance: { findMany: jest.fn() },
  trailProgress: { findMany: jest.fn() },
};

const adminUser: AuthenticatedUser = {
  userId: 'admin-001',
  tenantId: 'tenant-001',
  email: 'admin@test.com',
  roles: [Role.ADMIN_TENANT],
  name: 'Admin',
};

const liderUser: AuthenticatedUser = {
  userId: 'lider-001',
  tenantId: 'tenant-001',
  email: 'lider@test.com',
  roles: [Role.LIDER],
  name: 'Lider',
};

const baseQuery: LeaderSummaryQuery = { period: '30d' };

function resetMocks() {
  Object.values(mockTx).forEach((mock) => {
    if (typeof mock === 'object' && mock !== null) {
      Object.values(mock).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as jest.Mock).mockReset();
        }
      });
    }
  });
  // Default empty returns
  mockTx.group.findMany.mockResolvedValue([]);
  mockTx.groupMember.findMany.mockResolvedValue([]);
  mockTx.participantRadarStatus.findMany.mockResolvedValue([]);
  mockTx.meeting.findMany.mockResolvedValue([]);
  mockTx.meetingAttendance.findMany.mockResolvedValue([]);
  mockTx.trailProgress.findMany.mockResolvedValue([]);
}

describe('ReportsService.getLeaderSummary', () => {
  let service: ReportsService;

  beforeEach(async () => {
    resetMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: {} },
        { provide: BullMqService, useValue: { createQueue: jest.fn().mockReturnValue({ add: jest.fn() }) } },
        { provide: RedisService, useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
    // Prevent onModuleInit from running (no real bullmq)
    jest.spyOn(service, 'onModuleInit').mockImplementation(() => undefined);
  });

  it('lider sem grupos → retorna groups:[], summary zerado (200, NOT throw)', async () => {
    mockTx.groupMember.findMany.mockResolvedValue([]);

    const result = await service.getLeaderSummary(baseQuery, liderUser);

    expect(result.data.groups).toEqual([]);
    expect(result.data.summary.totalGroups).toBe(0);
    expect(result.data.summary.totalParticipants).toBe(0);
    expect(result.data.summary.overallAttendancePercent).toBeNull();
    expect(result.data.summary.overallTrailCompletionPercent).toBe(0);
  });

  it('lider com 2 grupos → retorna métricas corretas', async () => {
    // Lider memberships
    mockTx.groupMember.findMany
      .mockResolvedValueOnce([
        // lider memberships (resolveLeaderGroupUniverse call)
        { groupId: 'g1', group: { id: 'g1', name: 'Grupo 1' } },
        { groupId: 'g2', group: { id: 'g2', name: 'Grupo 2' } },
      ])
      // First computeGroupMetrics for g1: activeMembers
      .mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }])
      // First computeGroupMetrics for g2: activeMembers
      .mockResolvedValueOnce([{ userId: 'u3' }]);

    mockTx.participantRadarStatus.findMany
      .mockResolvedValueOnce([{ participantId: 'u1' }]) // g1: 1 at-risk
      .mockResolvedValueOnce([]); // g2: 0 at-risk

    mockTx.meeting.findMany
      .mockResolvedValueOnce([]) // g1: no meetings
      .mockResolvedValueOnce([]); // g2: no meetings

    mockTx.trailProgress.findMany
      .mockResolvedValueOnce([{ userId: 'u1', progressPercent: 50, completedAt: null }]) // g1
      .mockResolvedValueOnce([]); // g2

    const result = await service.getLeaderSummary(baseQuery, liderUser);

    expect(result.data.groups).toHaveLength(2);
    expect(result.data.groups[0].groupId).toBe('g1');
    expect(result.data.groups[0].atRiskCount).toBe(1);
    expect(result.data.groups[0].activeParticipantsCount).toBe(2);
    expect(result.data.groups[0].avgAttendancePercent).toBeNull();
    expect(result.data.summary.totalGroups).toBe(2);
    expect(result.data.summary.totalParticipants).toBe(3);
  });

  it('BOLA: lider pede groupId de outro líder → groups:[], 200', async () => {
    // Lider only has g1
    mockTx.groupMember.findMany.mockResolvedValueOnce([
      { groupId: 'g1', group: { id: 'g1', name: 'Grupo 1' } },
    ]);

    const queryWithForeignGroup: LeaderSummaryQuery = {
      period: '30d',
      groupId: 'g2-from-other-leader',
    };

    const result = await service.getLeaderSummary(queryWithForeignGroup, liderUser);

    expect(result.data.groups).toEqual([]);
    expect(result.data.summary.totalGroups).toBe(0);
  });

  it('admin vê todos grupos do tenant', async () => {
    mockTx.group.findMany.mockResolvedValueOnce([
      { id: 'g1', name: 'Grupo 1' },
      { id: 'g2', name: 'Grupo 2' },
      { id: 'g3', name: 'Grupo 3' },
    ]);
    // Each computeGroupMetrics: activeMembers, radarStatuses, meetings, trailProgress
    mockTx.groupMember.findMany.mockResolvedValue([]);
    mockTx.participantRadarStatus.findMany.mockResolvedValue([]);
    mockTx.meeting.findMany.mockResolvedValue([]);
    mockTx.trailProgress.findMany.mockResolvedValue([]);

    const result = await service.getLeaderSummary(baseQuery, adminUser);

    expect(mockTx.group.findMany).toHaveBeenCalledTimes(1);
    expect(result.data.groups).toHaveLength(3);
    expect(result.data.summary.totalGroups).toBe(3);
  });

  it('período custom é respeitado', async () => {
    mockTx.groupMember.findMany.mockResolvedValue([]);

    const customQuery: LeaderSummaryQuery = {
      period: 'custom',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-03-31T23:59:59Z',
    };

    const result = await service.getLeaderSummary(customQuery, liderUser);

    expect(result.meta.period).toBe('custom');
    expect(result.meta.startDate).toBe(new Date('2026-01-01T00:00:00Z').toISOString());
    expect(result.meta.endDate).toBe(new Date('2026-03-31T23:59:59Z').toISOString());
  });

  it('avgAttendancePercent null quando sem reuniões no período', async () => {
    mockTx.groupMember.findMany
      .mockResolvedValueOnce([{ groupId: 'g1', group: { id: 'g1', name: 'Grupo 1' } }])
      .mockResolvedValueOnce([{ userId: 'u1' }]);
    mockTx.participantRadarStatus.findMany.mockResolvedValueOnce([]);
    mockTx.meeting.findMany.mockResolvedValueOnce([]); // no meetings
    mockTx.trailProgress.findMany.mockResolvedValueOnce([]);

    const result = await service.getLeaderSummary(baseQuery, liderUser);

    expect(result.data.groups[0].avgAttendancePercent).toBeNull();
    expect(result.data.summary.overallAttendancePercent).toBeNull();
  });
});
