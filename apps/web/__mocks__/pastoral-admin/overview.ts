import type {
  ChurchOverviewResponse,
  GroupCard,
} from '@metanoia/types';

const groupIds = {
  jovens: '019756c0-0001-7000-8000-000000000001',
  casais: '019756c0-0001-7000-8000-000000000002',
  estudantes: '019756c0-0001-7000-8000-000000000003',
  novosCristaos: '019756c0-0001-7000-8000-000000000004',
} as const;

const leaderIds = {
  joao: '019756c0-0002-7000-8000-000000000001',
  mariana: '019756c0-0002-7000-8000-000000000002',
  rafael: '019756c0-0002-7000-8000-000000000003',
  beatriz: '019756c0-0002-7000-8000-000000000004',
} as const;

export const mockGroupCards: GroupCard[] = [
  {
    groupId: groupIds.casais,
    groupName: 'Casais',
    leaderId: leaderIds.mariana,
    leaderName: 'Mariana Santos',
    status: 'call',
    statusPhrase: 'Pastor, vale uma ligação',
    lastMeetingAt: '2026-03-25T20:00:00.000Z',
    memberCount: 10,
  },
  {
    groupId: groupIds.estudantes,
    groupName: 'Estudantes',
    leaderId: leaderIds.rafael,
    leaderName: 'Rafael Lima',
    status: 'attention',
    statusPhrase: 'Vale acompanhar',
    lastMeetingAt: '2026-04-08T19:30:00.000Z',
    memberCount: 7,
  },
  {
    groupId: groupIds.novosCristaos,
    groupName: 'Novos Cristãos',
    leaderId: leaderIds.beatriz,
    leaderName: 'Beatriz Oliveira',
    status: 'no-signal',
    statusPhrase: 'Sem sinal esta semana',
    lastMeetingAt: null,
    memberCount: 5,
  },
  {
    groupId: groupIds.jovens,
    groupName: 'Jovens Adultos',
    leaderId: leaderIds.joao,
    leaderName: 'João Silva',
    status: 'healthy',
    statusPhrase: 'Conversa saudável esta semana',
    lastMeetingAt: '2026-04-12T20:00:00.000Z',
    memberCount: 8,
  },
];

export const mockChurchOverview: ChurchOverviewResponse = {
  data: mockGroupCards,
  meta: {
    lastCalculatedAt: '2026-04-15T06:00:00.000Z',
    groupCount: mockGroupCards.length,
  },
};

export const mockChurchOverviewEmpty: ChurchOverviewResponse = {
  data: [],
  meta: {
    lastCalculatedAt: '2026-04-15T06:00:00.000Z',
    groupCount: 0,
  },
};

export { groupIds, leaderIds };
