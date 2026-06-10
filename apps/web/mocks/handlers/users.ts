import { http, HttpResponse } from 'msw';

const MOCK_USER_ID = '01912345-6789-7000-8000-0000000000a1';

export const usersHandlers = [
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
];
