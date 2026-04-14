import { http, HttpResponse } from 'msw';
import { mockDemoRadar } from '../../__mocks__/onboarding';

export const onboardingHandlers = [
  http.get('*/api/v1/onboarding/demo-radar', () =>
    HttpResponse.json({ data: mockDemoRadar }),
  ),
];
