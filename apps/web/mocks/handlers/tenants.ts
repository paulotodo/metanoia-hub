import { http, HttpResponse } from 'msw';
import type { TenantMeResponse } from '@metanoia/types';

const mockTenantMe: TenantMeResponse = {
  id: '019756b0-0001-7000-8000-000000000001',
  tenantId: '019756b0-1000-7000-8000-000000000001',
  name: 'Igreja Demo',
  createdAt: '2026-04-14T14:42:00.000Z',
};

export const tenantsHandlers = [
  http.get('*/api/v1/tenants/me', () =>
    HttpResponse.json({ data: mockTenantMe }),
  ),
];
