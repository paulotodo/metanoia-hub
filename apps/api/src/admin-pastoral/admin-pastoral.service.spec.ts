import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { AdminPastoralService } from './admin-pastoral.service';
import { requestContext } from '../common/context/request-context';

function createMocks() {
  const repo = {
    findAllGroupsWithLeader: vi.fn(),
    findLatestMeetingByGroup: vi.fn(),
    countActiveAlertsByGroup: vi.fn(),
    findGroupById: vi.fn(),
    findMeetingsForTimeline: vi.fn(),
    findCareActionsForGroup: vi.fn(),
    findLeaderProfile: vi.fn(),
    findLastConversation: vi.fn(),
    findRecentActivity: vi.fn(),
    findCurrentWeekIntent: vi.fn(),
    createOutreachIntent: vi.fn(),
    findOutreachIntentById: vi.fn(),
    updateOutreachIntent: vi.fn(),
    deleteOutreachIntent: vi.fn(),
  };
  const service = new AdminPastoralService(repo as never);
  return { service, repo };
}

const TENANT = '01912345-6789-7000-8000-000000000001';
const USER = '01912345-6789-7000-8000-0000000000aa';
const GROUP = '01912345-6789-7000-8000-000000000100';
const LEADER = '01912345-6789-7000-8000-0000000000b1';

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

function makeLeader() {
  return {
    id: generateId(),
    tenantId: TENANT,
    groupId: GROUP,
    userId: LEADER,
    role: 'lider',
    createdAt: new Date(),
    user: { id: LEADER, name: 'Maria Silva' },
  };
}

function makeGroupRow(overrides: Partial<{ name: string }> = {}) {
  const leader = makeLeader();
  return {
    id: GROUP,
    tenantId: TENANT,
    name: overrides.name ?? 'Grupo Quarta 19h',
    dayOfWeek: 'wed',
    time: '19:30',
    recurrence: 'weekly',
    notes: 'Sala Lateral',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [leader],
    _count: { members: 8 },
  };
}

describe('AdminPastoralService', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  // ---------------------------------------------------------------------
  // Church overview
  // ---------------------------------------------------------------------

  describe('getChurchOverview', () => {
    it('returns healthy when recent meeting has full attendance and no alerts', async () => {
      mocks.repo.findAllGroupsWithLeader.mockResolvedValue([makeGroupRow()]);
      mocks.repo.findLatestMeetingByGroup.mockResolvedValue({
        id: generateId(),
        scheduledFor: new Date(),
        participants: [
          { response: 'yes', joinedAt: new Date() },
          { response: 'yes', joinedAt: new Date() },
        ],
      });
      mocks.repo.countActiveAlertsByGroup.mockResolvedValue([]);

      const result = await withCtx(() => mocks.service.getChurchOverview());

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe('healthy');
      expect(result.data[0]?.statusPhrase).toBe('Grupo saudável');
      expect(result.meta.groupCount).toBe(1);
    });

    it('returns no-signal when no meetings in last 14 days', async () => {
      mocks.repo.findAllGroupsWithLeader.mockResolvedValue([makeGroupRow()]);
      mocks.repo.findLatestMeetingByGroup.mockResolvedValue(null);
      mocks.repo.countActiveAlertsByGroup.mockResolvedValue([]);

      const result = await withCtx(() => mocks.service.getChurchOverview());

      expect(result.data[0]?.status).toBe('no-signal');
    });

    it('returns call when care-urgent alerts exist', async () => {
      mocks.repo.findAllGroupsWithLeader.mockResolvedValue([makeGroupRow()]);
      mocks.repo.findLatestMeetingByGroup.mockResolvedValue({
        id: generateId(),
        scheduledFor: new Date(),
        participants: [{ response: 'yes', joinedAt: new Date() }],
      });
      mocks.repo.countActiveAlertsByGroup.mockResolvedValue([
        { signalType: 'care-urgent', _count: { _all: 2 } },
      ]);

      const result = await withCtx(() => mocks.service.getChurchOverview());

      expect(result.data[0]?.status).toBe('call');
    });

    it('returns attention when attendance is below 75%', async () => {
      mocks.repo.findAllGroupsWithLeader.mockResolvedValue([makeGroupRow()]);
      mocks.repo.findLatestMeetingByGroup.mockResolvedValue({
        id: generateId(),
        scheduledFor: new Date(),
        participants: [
          { response: 'yes', joinedAt: new Date() },
          { response: 'yes', joinedAt: new Date() },
          { response: 'no', joinedAt: null },
          { response: 'no', joinedAt: null },
        ],
      });
      mocks.repo.countActiveAlertsByGroup.mockResolvedValue([]);

      const result = await withCtx(() => mocks.service.getChurchOverview());

      expect(result.data[0]?.status).toBe('attention');
    });

    it('skips groups with no leader', async () => {
      const groupWithoutLeader = { ...makeGroupRow(), members: [] };
      mocks.repo.findAllGroupsWithLeader.mockResolvedValue([groupWithoutLeader]);

      const result = await withCtx(() => mocks.service.getChurchOverview());

      expect(result.data).toHaveLength(0);
      expect(result.meta.groupCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // Group timeline
  // ---------------------------------------------------------------------

  describe('getGroupTimeline', () => {
    it('throws NotFoundException when group is missing', async () => {
      mocks.repo.findGroupById.mockResolvedValue(null);

      await expect(
        withCtx(() => mocks.service.getGroupTimeline(GROUP)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('merges meeting and care entries sorted by occurredAt desc', async () => {
      mocks.repo.findGroupById.mockResolvedValue(makeGroupRow());
      mocks.repo.findLatestMeetingByGroup.mockResolvedValue({
        id: generateId(),
        scheduledFor: new Date(),
        participants: [{ response: 'yes', joinedAt: new Date() }],
      });
      mocks.repo.countActiveAlertsByGroup.mockResolvedValue([]);

      const meetingDate = new Date('2026-04-10T19:30:00Z');
      const careDate = new Date('2026-04-12T15:00:00Z');

      mocks.repo.findMeetingsForTimeline.mockResolvedValue([
        {
          id: generateId(),
          scheduledFor: meetingDate,
          participants: [
            { response: 'yes', joinedAt: new Date() },
            { response: 'no', joinedAt: null },
          ],
          reflections: [{ text: 'Deus fez obra esta semana.' }],
        },
      ]);

      mocks.repo.findCareActionsForGroup.mockResolvedValue([
        {
          id: generateId(),
          recordedAt: careDate,
          actionType: 'message',
          signalType: 'care-urgent',
          note: 'Enviei mensagem',
          participant: { name: 'João' },
        },
      ]);

      const result = await withCtx(() => mocks.service.getGroupTimeline(GROUP));

      expect(result.data.group.schedule).toBe('wed 19:30');
      expect(result.data.group.location).toBe('Sala Lateral');
      expect(result.data.entries).toHaveLength(2);
      expect(result.data.entries[0]?.type).toBe('care');
      expect(result.data.entries[1]?.type).toBe('meeting');

      const meetingEntry = result.data.entries[1];
      if (meetingEntry?.type === 'meeting') {
        expect(meetingEntry.presentCount).toBe(1);
        expect(meetingEntry.totalCount).toBe(2);
        expect(meetingEntry.reflectionText).toBe('Deus fez obra esta semana.');
      }
    });
  });

  // ---------------------------------------------------------------------
  // Leader view
  // ---------------------------------------------------------------------

  describe('getLeaderView', () => {
    it('throws NotFoundException when leader has no group membership', async () => {
      mocks.repo.findLeaderProfile.mockResolvedValue(null);

      await expect(
        withCtx(() => mocks.service.getLeaderView(LEADER)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns profile, lastConversation, recentActivity and currentWeekIntent', async () => {
      const leader = makeLeader();
      mocks.repo.findLeaderProfile.mockResolvedValue({
        ...leader,
        group: { id: GROUP, name: 'Grupo Quarta 19h' },
        createdAt: new Date(
          new Date().getTime() - 365 * 24 * 60 * 60 * 1000,
        ),
      });
      mocks.repo.findLastConversation.mockResolvedValue({
        id: generateId(),
        occurredAt: new Date('2026-04-01T14:00:00Z'),
        content: 'Conversámos sobre a equipa.',
      });
      mocks.repo.findRecentActivity.mockResolvedValue([
        {
          id: generateId(),
          recordedAt: new Date('2026-04-08T10:00:00Z'),
          actionType: 'message',
          note: 'Olá Maria',
        },
      ]);
      mocks.repo.findCurrentWeekIntent.mockResolvedValue({
        id: generateId(),
        targetLeaderId: LEADER,
        weekOf: new Date('2026-04-13T00:00:00Z'),
        note: 'Ligar esta semana',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await withCtx(() => mocks.service.getLeaderView(LEADER));

      expect(result.data.leader.firstName).toBe('Maria');
      expect(result.data.leader.fullName).toBe('Maria Silva');
      expect(result.data.leader.groupName).toBe('Grupo Quarta 19h');
      expect(result.data.lastConversation?.note).toBe(
        'Conversámos sobre a equipa.',
      );
      expect(result.data.recentActivity).toHaveLength(1);
      expect(result.data.recentActivity[0]?.description).toContain('Mensagem');
      expect(result.data.currentWeekIntent?.note).toBe('Ligar esta semana');
    });

    it('returns null lastConversation and currentWeekIntent when absent', async () => {
      mocks.repo.findLeaderProfile.mockResolvedValue({
        ...makeLeader(),
        group: { id: GROUP, name: 'Grupo Quarta 19h' },
      });
      mocks.repo.findLastConversation.mockResolvedValue(null);
      mocks.repo.findRecentActivity.mockResolvedValue([]);
      mocks.repo.findCurrentWeekIntent.mockResolvedValue(null);

      const result = await withCtx(() => mocks.service.getLeaderView(LEADER));

      expect(result.data.lastConversation).toBeNull();
      expect(result.data.currentWeekIntent).toBeNull();
      expect(result.data.recentActivity).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------
  // OutreachIntent CRUD
  // ---------------------------------------------------------------------

  describe('createOutreachIntent', () => {
    it('creates intent using context tenantId/userId', async () => {
      const intentId = generateId();
      mocks.repo.createOutreachIntent.mockResolvedValue({
        id: intentId,
        targetLeaderId: LEADER,
        weekOf: new Date('2026-04-13T00:00:00Z'),
        note: 'Ligar esta semana',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await withCtx(() =>
        mocks.service.createOutreachIntent({
          targetLeaderId: LEADER,
          weekOf: '2026-04-13T00:00:00.000Z',
          note: 'Ligar esta semana',
        }),
      );

      expect(mocks.repo.createOutreachIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          createdByUserId: USER,
          targetLeaderId: LEADER,
          note: 'Ligar esta semana',
        }),
      );
      expect(result.data.intentId).toBe(intentId);
    });

    it('throws UnauthorizedException when context is missing userId', async () => {
      await expect(
        requestContext.run(
          {
            tenantId: TENANT,
            requestId: generateId(),
            correlationId: generateId(),
          },
          () =>
            mocks.service.createOutreachIntent({
              targetLeaderId: LEADER,
              weekOf: '2026-04-13T00:00:00.000Z',
              note: 'x',
            }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('updateOutreachIntent', () => {
    it('updates note when intent exists', async () => {
      const intentId = generateId();
      mocks.repo.findOutreachIntentById.mockResolvedValue({ id: intentId });
      mocks.repo.updateOutreachIntent.mockResolvedValue({
        id: intentId,
        targetLeaderId: LEADER,
        weekOf: new Date('2026-04-13T00:00:00Z'),
        note: 'Novo texto',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await withCtx(() =>
        mocks.service.updateOutreachIntent(intentId, 'Novo texto'),
      );

      expect(result.data.note).toBe('Novo texto');
    });

    it('throws NotFoundException when intent is missing', async () => {
      mocks.repo.findOutreachIntentById.mockResolvedValue(null);

      await expect(
        withCtx(() =>
          mocks.service.updateOutreachIntent(generateId(), 'novo'),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteOutreachIntent', () => {
    it('deletes when intent exists', async () => {
      const intentId = generateId();
      mocks.repo.findOutreachIntentById.mockResolvedValue({ id: intentId });
      mocks.repo.deleteOutreachIntent.mockResolvedValue(undefined);

      await withCtx(() => mocks.service.deleteOutreachIntent(intentId));

      expect(mocks.repo.deleteOutreachIntent).toHaveBeenCalledWith(intentId);
    });

    it('throws NotFoundException when intent is missing', async () => {
      mocks.repo.findOutreachIntentById.mockResolvedValue(null);

      await expect(
        withCtx(() => mocks.service.deleteOutreachIntent(generateId())),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
