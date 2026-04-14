import { http, HttpResponse } from 'msw';
import type {
  InviteValidateResponse,
  AcceptTermsResponse,
  CreateAccountResponse,
} from '@metanoia/types';

const mockInviteValid: InviteValidateResponse = {
  status: 'valid',
  leader: {
    name: 'Pastor Demo',
    email: 'pastor.demo@igreja.example',
  },
  tenant: {
    id: '019756b0-1000-7000-8000-000000000001',
    name: 'Igreja Demo',
  },
};

const mockAcceptTermsResponse: AcceptTermsResponse = {
  acceptedAt: '2026-04-14T14:42:00.000Z',
};

const mockCreateAccountResponse: CreateAccountResponse = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  tenantId: '019756b0-1000-7000-8000-000000000001',
  userId: '019756b0-0001-7000-8000-000000000001',
  email: 'pastor.demo@igreja.example',
};

export const invitesHandlers = [
  http.get('*/api/v1/invites/:token', () =>
    HttpResponse.json({ data: mockInviteValid }),
  ),

  http.post('*/api/v1/invites/:token/accept-terms', () =>
    HttpResponse.json({ data: mockAcceptTermsResponse }),
  ),

  http.post('*/api/v1/invites/:token/create-account', () =>
    HttpResponse.json({ data: mockCreateAccountResponse }, { status: 201 }),
  ),
];
