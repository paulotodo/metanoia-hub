import type { GroupTimelineResponse } from '@metanoia/types';
import { groupIds, leaderIds } from './overview';

export const mockGroupTimeline: GroupTimelineResponse = {
  data: {
    group: {
      groupId: groupIds.jovens,
      groupName: 'Jovens Adultos',
      leaderId: leaderIds.joao,
      leaderName: 'João Silva',
      schedule: 'Quartas 20h',
      location: 'Sala 3',
      memberCount: 8,
      status: 'healthy',
      statusPhrase: 'Conversa saudável esta semana',
    },
    entries: [
      {
        entryId: '019756c0-0010-7000-8000-000000000001',
        occurredAt: '2026-04-12T20:00:00.000Z',
        type: 'meeting',
        presentCount: 6,
        totalCount: 8,
        reflectionText:
          'Boa conversa sobre Romanos 8. Pedro voltou depois de duas semanas.',
      },
      {
        entryId: '019756c0-0011-7000-8000-000000000001',
        occurredAt: '2026-04-10T15:30:00.000Z',
        type: 'care',
        participantName: 'Pedro Almeida',
        signalStatus: 'care-attention',
        careNote: 'Liguei. Ele está terminando um projeto pesado no trabalho.',
      },
      {
        entryId: '019756c0-0010-7000-8000-000000000002',
        occurredAt: '2026-04-05T20:00:00.000Z',
        type: 'meeting',
        presentCount: 5,
        totalCount: 8,
        reflectionText: null,
      },
    ],
  },
  meta: {
    windowStart: '2026-04-01T00:00:00.000Z',
    windowEnd: '2026-04-15T00:00:00.000Z',
  },
};

export const mockGroupTimelineEmpty: GroupTimelineResponse = {
  data: {
    group: {
      groupId: groupIds.novosCristaos,
      groupName: 'Novos Cristãos',
      leaderId: leaderIds.beatriz,
      leaderName: 'Beatriz Oliveira',
      schedule: 'Sextas 19h',
      location: 'Sala 1',
      memberCount: 5,
      status: 'no-signal',
      statusPhrase: 'Sem sinal esta semana',
    },
    entries: [],
  },
  meta: {
    windowStart: '2026-04-01T00:00:00.000Z',
    windowEnd: '2026-04-15T00:00:00.000Z',
  },
};
