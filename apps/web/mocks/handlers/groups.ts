import { http, HttpResponse } from 'msw';
import type { CreateGroupRequest, GroupResponse } from '@metanoia/types';

const MOCK_TENANT_ID = '019756b0-1000-7000-8000-000000000001';
const MOCK_GROUP_ID = '019756c0-2000-7000-8000-000000000001';

export const groupsHandlers = [
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
      createdAt: now,
      updatedAt: now,
    };

    return HttpResponse.json({ data: response }, { status: 201 });
  }),
];
