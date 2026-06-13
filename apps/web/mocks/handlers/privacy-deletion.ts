import { http, HttpResponse } from 'msw';
import type { PrivacyDeletionResponse, PrivacyDeletionStatus } from '@metanoia/types';
import {
  PRIVACY_DELETION_GRACE_DAYS,
  PRIVACY_DELETION_DEADLINE_DAYS,
} from '@metanoia/types';

// ---------------------------------------------------------------------------
// Simulated state
// ---------------------------------------------------------------------------

const MOCK_REQUEST_ID = '0199b000-0000-7000-8000-000000000002';

let _activeRequestId: string | null = null;
let _status: PrivacyDeletionStatus['status'] = 'pending';
let _duplicate = false;
let _leaderBlocker = false;

const NOW = () => new Date();
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const privacyDeletionHandlers = [
  /**
   * POST /api/v1/privacy/deletion
   * 201 on first call, 409 if duplicate, 422 if leader blocker.
   */
  http.post('*/api/v1/privacy/deletion', () => {
    if (_leaderBlocker) {
      return HttpResponse.json(
        {
          statusCode: 422,
          error: 'LEADER_ACTIVE_GROUPS',
          message: 'Você lidera grupos ativos. Transfira a liderança antes de excluir.',
          details: { groups: [{ id: 'g1', name: 'Grupo de Oração' }] },
        },
        { status: 422 },
      );
    }

    if (_duplicate) {
      return HttpResponse.json(
        { statusCode: 409, error: 'Conflict', message: 'Deletion request already active' },
        { status: 409 },
      );
    }

    const now = NOW();
    _activeRequestId = MOCK_REQUEST_ID;
    _status = 'pending';
    _duplicate = true;

    const response: { data: PrivacyDeletionResponse } = {
      data: {
        requestId: MOCK_REQUEST_ID,
        status: 'pending',
        cancellableUntil: addDays(now, PRIVACY_DELETION_GRACE_DAYS).toISOString(),
        deletionDeadline: addDays(now, PRIVACY_DELETION_DEADLINE_DAYS).toISOString(),
      },
    };

    return HttpResponse.json(response, { status: 201 });
  }),

  /**
   * DELETE /api/v1/privacy/deletion/:requestId
   * 204 on success, 404 if not found, 409 if past grace period.
   */
  http.delete('*/api/v1/privacy/deletion/:requestId', ({ params }) => {
    const { requestId } = params;

    if (requestId !== _activeRequestId) {
      return HttpResponse.json(
        { statusCode: 404, error: 'Not Found', message: 'Deletion request not found' },
        { status: 404 },
      );
    }

    _status = 'cancelled';
    _duplicate = false;
    _activeRequestId = null;

    return new HttpResponse(null, { status: 204 });
  }),

  /**
   * GET /api/v1/privacy/deletion/:requestId
   * Returns current deletion status.
   */
  http.get('*/api/v1/privacy/deletion/:requestId', ({ params }) => {
    const { requestId } = params;

    if (requestId !== _activeRequestId && _status !== 'cancelled') {
      return HttpResponse.json(
        { statusCode: 404, error: 'Not Found', message: 'Deletion request not found' },
        { status: 404 },
      );
    }

    const now = NOW();
    const response: { data: PrivacyDeletionStatus } = {
      data: {
        requestId: MOCK_REQUEST_ID,
        status: _status,
        cancellableUntil: addDays(now, PRIVACY_DELETION_GRACE_DAYS).toISOString(),
        deletionDeadline: addDays(now, PRIVACY_DELETION_DEADLINE_DAYS).toISOString(),
        cancelledAt: _status === 'cancelled' ? now.toISOString() : null,
        completedAt: _status === 'hard_deleted' ? now.toISOString() : null,
        failureReason: _status === 'failed' ? 'Internal processing error' : null,
      },
    };

    return HttpResponse.json(response);
  }),
];

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export function resetPrivacyDeletionMockState() {
  _activeRequestId = null;
  _status = 'pending';
  _duplicate = false;
  _leaderBlocker = false;
}

/** Simulate an already-active deletion request for banner tests. */
export function setPrivacyDeletionMockActive(requestId = MOCK_REQUEST_ID) {
  _activeRequestId = requestId;
  _status = 'pending';
  _duplicate = true;
}

/** Simulate leader blocker scenario. */
export function setPrivacyDeletionMockLeaderBlocker(value = true) {
  _leaderBlocker = value;
}

export { MOCK_REQUEST_ID as MOCK_DELETION_REQUEST_ID };
