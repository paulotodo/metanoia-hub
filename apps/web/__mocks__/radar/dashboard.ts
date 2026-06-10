import type { RadarDashboardResponse } from '@metanoia/types';

export const mockRadarDashboard: RadarDashboardResponse = {
  data: {
    distribution: {
      verde: 12,
      amarelo: 5,
      vermelho: 3,
      total: 20,
    },
    byGroup: [
      {
        groupId: '01912345-6789-7000-8000-000000000010',
        groupName: 'Grupo Alpha',
        verde: 7,
        amarelo: 2,
        vermelho: 1,
        total: 10,
      },
      {
        groupId: '01912345-6789-7000-8000-000000000020',
        groupName: 'Grupo Beta',
        verde: 5,
        amarelo: 3,
        vermelho: 2,
        total: 10,
      },
    ],
    trend: 'melhora',
    calculatedAt: '2026-06-10T12:00:00.000Z',
  },
  meta: {
    groupCount: 2,
    cachedAt: null,
  },
};
