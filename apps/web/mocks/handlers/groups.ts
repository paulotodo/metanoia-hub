import { http, HttpResponse } from 'msw';
import type { CreateGroupRequest, GroupResponse } from '@metanoia/types';

const MOCK_TENANT_ID = '019756b0-1000-7000-8000-000000000001';
const MOCK_GROUP_ID = '019756c0-2000-7000-8000-000000000001';
const MOCK_GROUP_DEMO_ID = '019756c0-2000-7000-8000-000000000002';

const MOCK_GROUPS: GroupResponse[] = [
  {
    id: MOCK_GROUP_DEMO_ID,
    tenantId: MOCK_TENANT_ID,
    name: 'Grupo Alpha (exemplo)',
    dayOfWeek: 'wed',
    time: '19:30',
    recurrence: 'weekly',
    notes: 'Dados de demonstração',
    isDemoData: true,
    status: 'active',
    breakUntil: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_GROUP_ID,
    tenantId: MOCK_TENANT_ID,
    name: 'Célula de Quinta',
    dayOfWeek: 'thu',
    time: '19:30',
    recurrence: 'weekly',
    notes: null,
    isDemoData: false,
    status: 'active',
    breakUntil: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
];

export const groupsHandlers = [
  http.get('*/api/v1/groups', () => {
    return HttpResponse.json(
      { data: MOCK_GROUPS, meta: { total: MOCK_GROUPS.length } },
      { status: 200 },
    );
  }),

  http.post('*/api/v1/groups', async ({ request }) => {
    const body = (await request.json()) as CreateGroupRequest;
    const now = new Date().toISOString();

    const response: GroupResponse = {
      id: MOCK_GROUP_ID,
      tenantId: MOCK_TENANT_ID,
      name: body.name,
      dayOfWeek: body.dayOfWeek,
      time: body.time,
      recurrence: body.recurrence ?? null,
      notes: body.notes ?? null,
      isDemoData: false,
      status: 'active',
      breakUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    return HttpResponse.json({ data: response }, { status: 201 });
  }),
];
