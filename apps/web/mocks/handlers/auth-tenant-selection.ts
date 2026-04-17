import { http, HttpResponse } from 'msw';
import type {
  MyTenantsResponse,
  SelectTenantResponse,
} from '@metanoia/types';

const mockUserTenants: MyTenantsResponse['data'] = [
  {
    tenantId: '019756d0-0001-7000-8000-000000000001',
    churchName: 'Igreja Batista Central',
    userRole: 'leader',
    lastVisit: '2026-04-16T18:00:00.000Z',
  },
  {
    tenantId: '019756d0-0001-7000-8000-000000000002',
    churchName: 'Comunidade Graça',
    userRole: 'admin_tenant',
    lastVisit: '2026-04-10T14:30:00.000Z',
  },
  {
    tenantId: '019756d0-0001-7000-8000-000000000003',
    churchName: 'Igreja da Vila',
    userRole: 'participant',
    lastVisit: null,
  },
];

export const authTenantSelectionHandlers = [
  http.get('*/api/v1/auth/my-tenants', () =>
    HttpResponse.json<MyTenantsResponse>({ data: mockUserTenants }),
  ),
  http.post('*/api/v1/auth/select-tenant', async ({ request }) => {
    const body = (await request.json()) as { tenantId: string };
    return HttpResponse.json<SelectTenantResponse>({
      data: { tenantId: body.tenantId },
    });
  }),
];
