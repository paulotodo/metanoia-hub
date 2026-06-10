import { http, HttpResponse } from 'msw';
import {
  mockRadarPageData,
  mockSignalDetail,
  mockParticipantProfile,
  mockCareActionResponse,
  mockRadarDashboard,
  mockParticipantTimeline,
  mockNudges,
  mockCelebrations,
} from '../../__mocks__/radar';

export const radarHandlers = [
  http.get('*/api/v1/radar', () =>
    HttpResponse.json({ data: mockRadarPageData }),
  ),

  // Story 6-6 — aggregate dashboard (admin_tenant & lider)
  http.get('*/api/v1/radar/dashboard', () =>
    HttpResponse.json(mockRadarDashboard),
  ),

  // Story 6-5 — pastoral nudge suggestions
  http.get('*/api/v1/radar/nudges', () =>
    HttpResponse.json({ data: mockNudges }),
  ),

  // Story 6-5 — recent positive transitions for CelebrationBanner
  http.get('*/api/v1/radar/celebrations', () =>
    HttpResponse.json({ data: mockCelebrations }),
  ),

  http.get('*/api/v1/radar/:id', () =>
    HttpResponse.json({ data: mockSignalDetail }),
  ),

  http.get('*/api/v1/radar/:id/profile', () =>
    HttpResponse.json({ data: mockParticipantProfile }),
  ),

  // Story 6-4 — merged individual timeline (presence + pastoral actions)
  http.get('*/api/v1/radar/:id/timeline', () =>
    HttpResponse.json({ data: mockParticipantTimeline }),
  ),

  http.post('*/api/v1/radar/:id/actions', () =>
    HttpResponse.json({ data: mockCareActionResponse }, { status: 201 }),
  ),
];
