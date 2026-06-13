import { http, HttpResponse } from 'msw';
import type { TenantMeResponse } from '@metanoia/types';

const mockTenantMe: TenantMeResponse = {
  id: '019756b0-0001-7000-8000-000000000001',
  tenantId: '019756b0-1000-7000-8000-000000000001',
  name: 'Igreja Demo',
  focusIndicatorEnabled: false,
  createdAt: '2026-04-14T14:42:00.000Z',
};

export const tenantsHandlers = [
  http.get('*/api/v1/tenants/me', () =>
    HttpResponse.json({ data: mockTenantMe }),
  ),

  // PATCH /api/v1/tenants/me — update tenant profile + onboarding progress (Story 10-1)
  http.patch('*/api/v1/tenants/me', () =>
    HttpResponse.json({
      data: {
        id: mockTenantMe.id,
        name: mockTenantMe.name,
        denomination: null,
        city: null,
        state: null,
        logoUrl: null,
        onboardingProgress: null,
      },
    }),
  ),
];
