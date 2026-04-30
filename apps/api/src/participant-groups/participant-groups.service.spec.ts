import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { ParticipantGroupsService } from './participant-groups.service';
import { requestContext } from '../common/context/request-context';

const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const USER_ID = '01912345-6789-7000-8000-000000000abc';
const OTHER_USER_ID = '01912345-6789-7000-8000-000000000def';

function buildGroupRow(overrides: Record<string, unknown> = {}) {
  return {
    id: generateId(),
    tenantId: TENANT_ID,
    name: 'Célula da Paz',
    dayOfWeek: 'wed',
    time: '19:30',
    recurrence: 'weekly',
    notes: 'Grupo de cuidado pastoral',
    members: [
      {
        role: 'lider',
        user: { id: 'leader-id', name: 'Marcos Silva' },
      },
      {
        role: 'membro',
        user: { id: USER_ID, name: 'Bruno Santos' },
      },
      {
        role: 'membro',
        user: { id: 'peer-1', name: 'Carla Oliveira Lima' },
      },
      {
        role: 'membro',
        user: { id: 'peer-2', name: 'Diana' },
      },
    ],
    ...overrides,
  };
}

function createMocks() {
  const repository = {
    findGroupsForUser: vi.fn(),
    findGroupForUser: vi.fn(),
    findNextMeeting: vi.fn().mockResolvedValue(null),
  };

  const redis = {
    set: vi.fn().mockResolvedValue('OK'),
  };

  const service = new ParticipantGroupsService(
    repository as any,
    redis as any,
  );

  return { service, repository, redis };
}

async function withContext<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT_ID,
      userId: USER_ID,
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('ParticipantGroupsService.list', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it('returns groups mapped through the contract schema', async () => {
    mocks.repository.findGroupsForUser.mockResolvedValue([buildGroupRow()]);
    mocks.repository.findNextMeeting.mockResolvedValue(null);

    const result = await withContext(() => mocks.service.list());

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Célula da Paz');
    expect(result.data[0].leader.firstName).toBe('Marcos');
    expect(result.data[0].leader.avatarUrl).toBeNull();
    expect(result.data[0].nextMeeting).toBeNull();
  });

  it('attaches the next meeting summary when one exists', async () => {
    const scheduledFor = new Date('2026-05-06T22:30:00Z');
    mocks.repository.findGroupsForUser.mockResolvedValue([buildGroupRow()]);
    mocks.repository.findNextMeeting.mockResolvedValue({
      id: 'm1',
      scheduledFor,
      livekitRoomId: null,
    });

    const result = await withContext(() => mocks.service.list());

    expect(result.data[0].nextMeeting).toEqual({
      startsAt: scheduledFor.toISOString(),
      dayOfWeek: 'wed',
      time: '19:30',
      location: null,
      meetingUrl: null,
    });
  });

  it('marks firstVisit=true on the first call and false thereafter', async () => {
    mocks.repository.findGroupsForUser.mockResolvedValue([]);

    mocks.redis.set.mockResolvedValueOnce('OK');
    const first = await withContext(() => mocks.service.list());
    expect(first.meta.firstVisit).toBe(true);

    mocks.redis.set.mockResolvedValueOnce(null);
    const second = await withContext(() => mocks.service.list());
    expect(second.meta.firstVisit).toBe(false);

    expect(mocks.redis.set).toHaveBeenCalledWith(
      `participant:first-visit-groups:${USER_ID}`,
      '1',
      'NX',
    );
  });
});

describe('ParticipantGroupsService.detail', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it('throws 404 when the group is not found or user is not a member', async () => {
    mocks.repository.findGroupForUser.mockResolvedValue(null);

    await expect(
      withContext(() => mocks.service.detail(generateId())),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns peers as first names only, excluding the requester', async () => {
    mocks.repository.findGroupForUser.mockResolvedValue(buildGroupRow());

    const result = await withContext(() =>
      mocks.service.detail('group-id'),
    );

    const peerFirstNames = result.data.peers?.map((p) => p.firstName);
    expect(peerFirstNames).toEqual(['Carla', 'Diana']);
    // The requester (USER_ID, name "Bruno Santos") must not appear in peers.
    expect(peerFirstNames).not.toContain('Bruno');
    // No last names must leak through.
    expect(peerFirstNames?.some((n) => n.includes(' '))).toBe(false);
  });

  it('maps description from group.notes and surfaces leader by first name', async () => {
    mocks.repository.findGroupForUser.mockResolvedValue(buildGroupRow());

    const result = await withContext(() =>
      mocks.service.detail('group-id'),
    );

    expect(result.data.description).toBe('Grupo de cuidado pastoral');
    expect(result.data.leader.firstName).toBe('Marcos');
    expect(result.data.format).toBeNull();
    expect(result.data.duration).toBeNull();
  });

  it('returns description=null when group has no notes', async () => {
    mocks.repository.findGroupForUser.mockResolvedValue(
      buildGroupRow({ notes: null }),
    );

    const result = await withContext(() =>
      mocks.service.detail('group-id'),
    );

    expect(result.data.description).toBeNull();
  });

  it('omits the requester even when other users share the same first name', async () => {
    mocks.repository.findGroupForUser.mockResolvedValue(
      buildGroupRow({
        members: [
          {
            role: 'lider',
            user: { id: 'leader-id', name: 'Marcos Silva' },
          },
          {
            role: 'membro',
            user: { id: USER_ID, name: 'Bruno Santos' },
          },
          {
            role: 'membro',
            user: { id: OTHER_USER_ID, name: 'Bruno Almeida' },
          },
        ],
      }),
    );

    const result = await withContext(() =>
      mocks.service.detail('group-id'),
    );

    // Both share the first name "Bruno", but only the *other* one is a peer.
    expect(result.data.peers).toEqual([{ firstName: 'Bruno' }]);
  });
});
