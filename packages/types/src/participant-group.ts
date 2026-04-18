import { z } from 'zod';
import { DayOfWeekSchema, GroupRecurrenceSchema } from './group';

// ============================================================================
// Participant-side group contracts — Cenário 06 (Juliana).
//
// API: GET /api/v1/participant/groups + GET /api/v1/participant/groups/:id
// Routes: /app/consumo/grupos + /app/consumo/grupos/[id]
//
// Privacy rules (06.5):
//  - "Other participants" list shows only first name (no avatar, no contact).
//  - Leader is surfaced with first name + optional avatar.
//  - No metrics, no scores, no signal dots — this is the participant's view,
//    not the leader's radar.
// ============================================================================

const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// --- Leader mini card (first name + optional avatar)

export const ParticipantGroupLeaderSchema = z.object({
  firstName: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
});
export type ParticipantGroupLeader = z.infer<typeof ParticipantGroupLeaderSchema>;

// --- Next meeting summary (shared by list and detail)

export const ParticipantGroupNextMeetingSchema = z.object({
  startsAt: z.string().datetime(),
  dayOfWeek: DayOfWeekSchema,
  time: z.string().regex(TIME_HH_MM_REGEX),
  meetingUrl: z.string().url().nullable(),
});
export type ParticipantGroupNextMeeting = z.infer<
  typeof ParticipantGroupNextMeetingSchema
>;

// --- GET /api/v1/participant/groups — list

export const ParticipantGroupSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  leader: ParticipantGroupLeaderSchema,
  nextMeeting: ParticipantGroupNextMeetingSchema.nullable(),
});
export type ParticipantGroupSummary = z.infer<
  typeof ParticipantGroupSummarySchema
>;

export const ParticipantGroupsListMetaSchema = z.object({
  firstVisit: z.boolean(),
});
export type ParticipantGroupsListMeta = z.infer<
  typeof ParticipantGroupsListMetaSchema
>;

export const ParticipantGroupsListResponseSchema = z.object({
  data: z.array(ParticipantGroupSummarySchema),
  meta: ParticipantGroupsListMetaSchema,
});
export type ParticipantGroupsListResponse = z.infer<
  typeof ParticipantGroupsListResponseSchema
>;

// --- GET /api/v1/participant/groups/:id — detail

export const ParticipantGroupPeerSchema = z.object({
  firstName: z.string().min(1),
});
export type ParticipantGroupPeer = z.infer<typeof ParticipantGroupPeerSchema>;

export const ParticipantGroupDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  leader: ParticipantGroupLeaderSchema,
  recurrence: GroupRecurrenceSchema,
  nextMeeting: ParticipantGroupNextMeetingSchema.nullable(),
  peers: z.array(ParticipantGroupPeerSchema),
});
export type ParticipantGroupDetail = z.infer<
  typeof ParticipantGroupDetailSchema
>;

export const ParticipantGroupDetailResponseSchema = z.object({
  data: ParticipantGroupDetailSchema,
});
export type ParticipantGroupDetailResponse = z.infer<
  typeof ParticipantGroupDetailResponseSchema
>;
