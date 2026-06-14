import { http, HttpResponse } from 'msw';
import { checkEmailsResponseSchema } from '@metanoia/types';

const MOCK_USER_ID = '01912345-6789-7000-8000-0000000000a1';

/** Mutable in-memory user status for tests (use server.use() to override). */
let _userStatus: 'pending_verification' | 'active' | 'deletion_pending' | 'deleted' = 'active';

/** Reset user mock state between tests. */
export function resetUserMockState() {
  _userStatus = 'active';
}

/** Set the simulated user status (e.g. for deletion_pending banner tests). */
export function setUserMockStatus(
  status: 'pending_verification' | 'active' | 'deletion_pending' | 'deleted',
) {
  _userStatus = status;
}

export const usersHandlers = [
  // GET /api/v1/users/me — returns current user profile including status
  http.get('*/api/v1/users/me', () =>
    HttpResponse.json({
      data: {
        id: MOCK_USER_ID,
        email: 'joao@igrejabetania.com.br',
        name: 'João Silva',
        status: _userStatus,
      },
    }),
  ),

  // GET /api/v1/users/me/onboarding-status
  // Default: onboarding NOT complete (null) — can be overridden per-test
  http.get('*/api/v1/users/me/onboarding-status', () =>
    HttpResponse.json({ data: { onboardingCompletedAt: null } }),
  ),

  // PATCH /api/v1/users/me/onboarding-complete
  http.patch('*/api/v1/users/me/onboarding-complete', () =>
    HttpResponse.json({
      data: {
        userId: MOCK_USER_ID,
        onboardingCompletedAt: new Date().toISOString(),
      },
    }),
  ),

  // PATCH /api/v1/users/me — update user profile (Story 10-1)
  http.patch('*/api/v1/users/me', () =>
    HttpResponse.json({
      data: {
        id: MOCK_USER_ID,
        name: 'João Silva',
        profilePhotoUrl: null,
        roleTitle: null,
      },
    }),
  ),

  // GET /api/v1/users/check-emails — Story 10-3 (CSV import preview)
  // Returns existence check per email. Shape validated via checkEmailsResponseSchema.
  http.get('*/api/v1/users/check-emails', ({ request }) => {
    const url = new URL(request.url);
    const emailsParam = url.searchParams.get('emails') ?? '';
    const emails = emailsParam
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    // Default mock: no email is a pre-existing member (all exists: false).
    // Override with server.use() in tests that need specific scenarios.
    const results = emails.map((email) => ({ email, exists: false }));

    const payload = {
      data: { results },
      meta: { checkedCount: results.length, tenantScoped: true as const },
    };

    // Runtime shape assertion — ensures mock stays in sync with schema
    checkEmailsResponseSchema.parse(payload);

    return HttpResponse.json(payload);
  }),
];
