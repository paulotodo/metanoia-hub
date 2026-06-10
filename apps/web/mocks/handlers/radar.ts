import { http, HttpResponse } from 'msw';
import {
  mockRadarPageData,
  mockSignalDetail,
  mockParticipantProfile,
  mockCareActionResponse,
  mockRadarDashboard,
} from '../../__mocks__/radar';

export const radarHandlers = [
  http.get('*/api/v1/radar', () =>
    HttpResponse.json({ data: mockRadarPageData }),
  ),

  // Story 6-6 — aggregate dashboard (admin_tenant & lider)
  http.get('*/api/v1/radar/dashboard', () =>
    HttpResponse.json(mockRadarDashboard),
  ),

  http.get('*/api/v1/radar/:id', () =>
    HttpResponse.json({ data: mockSignalDetail }),
  ),

  http.get('*/api/v1/radar/:id/profile', () =>
    HttpResponse.json({ data: mockParticipantProfile }),
  ),

  http.post('*/api/v1/radar/:id/actions', () =>
    HttpResponse.json({ data: mockCareActionResponse }, { status: 201 }),
  ),
];
