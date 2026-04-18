import { http, HttpResponse } from 'msw';
import type {
  InviteValidateResponse,
  AcceptTermsResponse,
  CreateAccountResponse,
  InviteResolveResponse,
  AcceptParticipantInviteResponse,
} from '@metanoia/types';

const MOCK_TENANT_ID = '019756b0-1000-7000-8000-000000000001';
const MOCK_GROUP_ID = '019756c0-2000-7000-8000-000000000001';
const MOCK_USER_ID = '019756b0-0001-7000-8000-000000000042';

const mockInviteValid: InviteValidateResponse = {
  status: 'valid',
  leader: {
    name: 'Pastor Demo',
    email: 'pastor.demo@igreja.example',
  },
  tenant: {
    id: MOCK_TENANT_ID,
    name: 'Igreja Demo',
  },
};

const mockAcceptTermsResponse: AcceptTermsResponse = {
  acceptedAt: '2026-04-14T14:42:00.000Z',
};

const mockCreateAccountResponse: CreateAccountResponse = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  tenantId: MOCK_TENANT_ID,
  userId: '019756b0-0001-7000-8000-000000000001',
  email: 'pastor.demo@igreja.example',
};

// --- Cenário 06: discriminated-union /resolve endpoint ---------------------

const resolveFixtures: Record<string, InviteResolveResponse> = {
  'admin-tenant-valid': {
    status: 'valid',
    invite: {
      kind: 'admin-tenant',
      leader: {
        name: 'Pastor Demo',
        email: 'pastor.demo@igreja.example',
      },
      tenant: {
        id: MOCK_TENANT_ID,
        name: 'Igreja Demo',
      },
    },
  },
  'participant-valid': {
    status: 'valid',
    invite: {
      kind: 'participant',
      leader: {
        firstName: 'Marcos',
        avatarUrl: null,
      },
      tenant: {
        id: MOCK_TENANT_ID,
        name: 'Igreja Demo',
      },
      group: {
        id: MOCK_GROUP_ID,
        name: 'Fundamentos da Fé',
      },
    },
  },
  'participant-expired': {
    status: 'expired',
    invite: null,
  },
  'participant-used': {
    status: 'used',
    invite: null,
  },
};

const mockAcceptParticipantResponse: AcceptParticipantInviteResponse = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  tenantId: MOCK_TENANT_ID,
  groupId: MOCK_GROUP_ID,
  userId: MOCK_USER_ID,
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

  http.get('*/api/v1/invites/:token/resolve', ({ params }) => {
    const token = String(params.token ?? '');
    const fixture =
      resolveFixtures[token] ?? ({ status: 'invalid', invite: null } satisfies InviteResolveResponse);
    return HttpResponse.json({ data: fixture });
  }),

  http.post('*/api/v1/invites/:token/accept', ({ params }) => {
    const token = String(params.token ?? '');
    const fixture = resolveFixtures[token];
    if (!fixture || fixture.status !== 'valid' || fixture.invite?.kind !== 'participant') {
      return HttpResponse.json(
        {
          statusCode: 409,
          error: 'Conflict',
          message: 'Invite is not acceptable for participant flow',
        },
        { status: 409 },
      );
    }
    return HttpResponse.json({ data: mockAcceptParticipantResponse }, { status: 201 });
  }),
];
