import type {
  LeaderViewResponse,
  OutreachIntentResponse,
} from '@metanoia/types';
import { leaderIds } from './overview';

export const mockLeaderView: LeaderViewResponse = {
  data: {
    leader: {
      leaderId: leaderIds.joao,
      firstName: 'João',
      fullName: 'João Silva',
      groupName: 'Jovens Adultos',
      tenure: '2 anos',
    },
    lastConversation: {
      conversationId: '019756c0-0030-7000-8000-000000000001',
      occurredAt: '2026-03-22T16:00:00.000Z',
      note: 'Conversamos sobre o trabalho dele e a expectativa do casamento.',
    },
    recentActivity: [
      {
        entryId: '019756c0-0040-7000-8000-000000000001',
        occurredAt: '2026-04-12T20:30:00.000Z',
        description: 'Registrou reflexão da reunião dos Jovens Adultos.',
      },
      {
        entryId: '019756c0-0040-7000-8000-000000000002',
        occurredAt: '2026-04-10T15:30:00.000Z',
        description: 'Cuidou de Pedro Almeida (sinal de atenção).',
      },
    ],
    currentWeekIntent: null,
  },
};

export const mockLeaderViewWithIntent: LeaderViewResponse = {
  data: {
    ...mockLeaderView.data,
    currentWeekIntent: {
      intentId: '019756c0-0020-7000-8000-000000000001',
      targetLeaderId: leaderIds.joao,
      weekOf: '2026-04-13T00:00:00.000Z',
      note: 'Perguntar como ele está se sentindo conduzindo o grupo.',
      createdAt: '2026-04-15T17:30:00.000Z',
      updatedAt: '2026-04-15T17:30:00.000Z',
    },
  },
};

export const mockOutreachIntentResponse: OutreachIntentResponse = {
  data: {
    intentId: '019756c0-0020-7000-8000-000000000099',
    targetLeaderId: leaderIds.joao,
    weekOf: '2026-04-13T00:00:00.000Z',
    note: 'Perguntar como ele está se sentindo conduzindo o grupo.',
    createdAt: '2026-04-15T17:30:00.000Z',
    updatedAt: '2026-04-15T17:30:00.000Z',
  },
};
