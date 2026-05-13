import { useQuery } from '@tanstack/react-query';
import type {
  MeetingReportPersonal,
  MeetingReportSummary,
} from '@metanoia/types';
import { apiClient } from '../client';

export type MeetingReportEnvelope =
  | {
      data: {
        id: string;
        meetingId: string;
        summary: MeetingReportSummary;
        generatedAt: string;
      };
      meta: { view: 'full' };
    }
  | { data: MeetingReportPersonal; meta: { view: 'personal' } };

/** Pass-through schema for the apiClient (raw JSON parse, no Zod validation
 * on the client). Server-side Zod validation in ReportService is the source
 * of truth; the client trusts the contract. */
const ReportEnvelopeSchema = {
  parse: (data: unknown): MeetingReportEnvelope => data as MeetingReportEnvelope,
};

export const meetingReportKeys = {
  detail: (meetingId: string) => ['meetings', 'report', meetingId] as const,
};

export function useMeetingReport(meetingId: string) {
  return useQuery({
    queryKey: meetingReportKeys.detail(meetingId),
    queryFn: () =>
      apiClient.getEnvelope(`/meetings/${meetingId}/report`, ReportEnvelopeSchema),
    enabled: meetingId.length > 0,
    staleTime: 1000 * 30,
  });
}
