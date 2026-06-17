import { useQuery } from '@tanstack/react-query';
import type {
  MeetingReportPersonal,
  MeetingLeaderReportResponse,
} from '@metanoia/types';
import { apiClient } from '../client';

// ─── Response envelope types ──────────────────────────────────────────────────

/**
 * Full FR63 leader view — returned when canSeeFull=true.
 * Contains metrics aggregate + per-participant list with engagement data.
 */
export type MeetingLeaderReportEnvelope = {
  data: MeetingLeaderReportResponse['data'];
  meta: { view: 'full' };
};

/** Personal view — returned for Participantes (canSeeFull=false). */
export type MeetingPersonalReportEnvelope = {
  data: MeetingReportPersonal;
  meta: { view: 'personal' };
};

export type MeetingReportEnvelope =
  | MeetingLeaderReportEnvelope
  | MeetingPersonalReportEnvelope;

/** Pass-through: server Zod validation is source of truth; client trusts the contract. */
const ReportEnvelopeSchema = {
  parse: (data: unknown): MeetingReportEnvelope => data as MeetingReportEnvelope,
};

// ─── Query keys ───────────────────────────────────────────────────────────────

export const meetingReportKeys = {
  detail: (meetingId: string) => ['meetings', 'report', meetingId] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the meeting report for the authenticated user.
 *
 * - Leaders/admins (canSeeFull=true on the server): receive FR63 leader view
 *   with `metrics` + `participants` array + engagement scores.
 * - Participantes: receive personal view with their own attendance row.
 *
 * The `meta.view` field discriminates the response shape.
 */
export function useMeetingReport(meetingId: string) {
  return useQuery({
    queryKey: meetingReportKeys.detail(meetingId),
    queryFn: () =>
      apiClient.getEnvelope(`/meetings/${meetingId}/report`, ReportEnvelopeSchema),
    enabled: meetingId.length > 0,
    staleTime: 1000 * 30,
  });
}
