import { http, HttpResponse } from 'msw';
import type { PrivacyExportJobResponse, PrivacyExportStatus } from '@metanoia/types';
import { PRIVACY_EXPORT_ESTIMATED_HOURS } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Simulated state — progresses through accepted → processing → completed
// ---------------------------------------------------------------------------

const MOCK_JOB_ID = '0199a000-0000-7000-8000-000000000001';
const MOCK_SIGNED_URL =
  'https://minio.example.com/exports/global/0199a000-data.json?X-Amz-Expires=172800';

/** In-memory poll counter to simulate status progression in dev. */
let _pollCount = 0;
let _activeJobId: string | null = null;
let _duplicate = false;

function getSimulatedStatus(): PrivacyExportStatus['status'] {
  if (_pollCount < 2) return 'accepted';
  if (_pollCount < 4) return 'processing';
  return 'completed';
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const privacyHandlers = [
  /**
   * POST /api/v1/privacy/export
   * Returns 202 with jobId on first call, 409 if a job is already active.
   */
  http.post('*/api/v1/privacy/export', () => {
    if (_duplicate) {
      return HttpResponse.json(
        { statusCode: 409, error: 'Conflict', message: 'Export already in progress' },
        { status: 409 },
      );
    }

    _pollCount = 0;
    _activeJobId = MOCK_JOB_ID;
    _duplicate = true;

    const response: { data: PrivacyExportJobResponse } = {
      data: {
        jobId: MOCK_JOB_ID,
        status: 'accepted',
        estimatedCompletionHours: PRIVACY_EXPORT_ESTIMATED_HOURS,
      },
    };

    return HttpResponse.json(response, { status: 202 });
  }),

  /**
   * GET /api/v1/privacy/export/:jobId
   * Simulates status progression: accepted → processing → completed.
   */
  http.get('*/api/v1/privacy/export/:jobId', ({ params }) => {
    const { jobId } = params;

    if (jobId !== _activeJobId) {
      return HttpResponse.json(
        { statusCode: 404, error: 'Not Found', message: 'Export job not found' },
        { status: 404 },
      );
    }

    const currentStatus = getSimulatedStatus();
    _pollCount++;

    if (currentStatus === 'completed') {
      // Reset after completion so next POST is not a duplicate
      _duplicate = false;
    }

    const response: { data: PrivacyExportStatus } = {
      data: {
        jobId: MOCK_JOB_ID,
        status: currentStatus,
        signedUrl: currentStatus === 'completed' ? MOCK_SIGNED_URL : null,
        expiresAt:
          currentStatus === 'completed'
            ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            : null,
        failureReason: null,
      },
    };

    return HttpResponse.json(response);
  }),
];

// ---------------------------------------------------------------------------
// Test helper — reset state between tests
// ---------------------------------------------------------------------------
export function resetPrivacyMockState() {
  _pollCount = 0;
  _activeJobId = null;
  _duplicate = false;
}
