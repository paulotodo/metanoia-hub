import { http, HttpResponse } from 'msw';
import { mockDemoRadar } from '../../__mocks__/onboarding';

const MOCK_WIZARD_STATUS = {
  progress: {
    currentStep: 1,
    completedSteps: [] as number[],
    stepData: {} as Record<string, unknown>,
    completed: false,
    completedAt: null,
    skippedAt: null,
  },
  hasRealGroups: false,
};

export const onboardingHandlers = [
  http.get('*/api/v1/onboarding/demo-radar', () =>
    HttpResponse.json({ data: mockDemoRadar }),
  ),

  // GET /api/v1/onboarding/status — wizard status (Story 10-1)
  http.get('*/api/v1/onboarding/status', () =>
    HttpResponse.json({ data: MOCK_WIZARD_STATUS }),
  ),

  // GET /api/v1/onboarding/demo-status
  http.get('*/api/v1/onboarding/demo-status', () =>
    HttpResponse.json({
      hasDemoData: true,
      hasRealData: false,
      demoRecordCount: 3,
      nudgeDismissed: false,
    }),
  ),
];
