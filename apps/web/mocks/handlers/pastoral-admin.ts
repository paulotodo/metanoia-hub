import { http, HttpResponse } from 'msw';
import {
  mockChurchOverview,
  mockGroupTimeline,
  mockLeaderView,
  mockOutreachIntentResponse,
} from '../../__mocks__/pastoral-admin';

export const pastoralAdminHandlers = [
  http.get('*/api/v1/admin/church/overview', () =>
    HttpResponse.json(mockChurchOverview),
  ),

  http.get('*/api/v1/admin/church/groups/:groupId/timeline', () =>
    HttpResponse.json(mockGroupTimeline),
  ),

  http.get('*/api/v1/admin/church/leaders/:leaderId', () =>
    HttpResponse.json(mockLeaderView),
  ),

  http.post('*/api/v1/admin/outreach-intents', () =>
    HttpResponse.json(mockOutreachIntentResponse, { status: 201 }),
  ),

  http.put('*/api/v1/admin/outreach-intents/:intentId', () =>
    HttpResponse.json(mockOutreachIntentResponse),
  ),

  http.delete('*/api/v1/admin/outreach-intents/:intentId', () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
