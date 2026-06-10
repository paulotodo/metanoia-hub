import { z } from 'zod';

// --- Enums ---

export const SignalTypeSchema = z.enum([
  'care-urgent',
  'care-attention',
  'care-ok',
]);
export type SignalType = z.infer<typeof SignalTypeSchema>;

export const CareActionTypeSchema = z.enum([
  'message',
  'call',
  'visit',
  'prayer',
]);
export type CareActionType = z.infer<typeof CareActionTypeSchema>;

export const PresenceDotSchema = z.enum([
  'present',
  'absent',
  'no-meeting',
]);
export type PresenceDot = z.infer<typeof PresenceDotSchema>;

export const SignalVariantSchema = z.enum([
  'absence',
  'early-exit',
  'decline',
  'post-event',
  'fallback',
]);
export type SignalVariant = z.infer<typeof SignalVariantSchema>;

// --- Last Care Record (shared sub-schema) ---

export const LastCareRecordSchema = z.object({
  date: z.string().datetime(),
  type: CareActionTypeSchema,
});
export type LastCareRecord = z.infer<typeof LastCareRecordSchema>;

// --- Radar Page (01.2) ---

export const RadarParticipantSchema = z.object({
  participantId: z.string().uuid(),
  name: z.string(),
  signalType: SignalTypeSchema,
  contextPhrase: z.string().nullable(),
  groupId: z.string().uuid(),
  groupName: z.string(),
  presenceDots: z.array(PresenceDotSchema),
  lastCareRecord: LastCareRecordSchema.nullable(),
});
export type RadarParticipant = z.infer<typeof RadarParticipantSchema>;

export const RadarGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type RadarGroup = z.infer<typeof RadarGroupSchema>;

export const RadarSignalCountsSchema = z.object({
  careUrgent: z.number().int().min(0),
  careAttention: z.number().int().min(0),
  careOk: z.number().int().min(0),
  deltaUrgent: z.number().int(),
  deltaAttention: z.number().int(),
  deltaOk: z.number().int(),
});
export type RadarSignalCounts = z.infer<typeof RadarSignalCountsSchema>;

export const RadarPageDataSchema = z.object({
  participants: z.array(RadarParticipantSchema),
  groups: z.array(RadarGroupSchema),
  signalCounts: RadarSignalCountsSchema,
  userFirstName: z.string(),
  lastSeenAt: z.string().datetime().nullable(),
  nextMeeting: z
    .object({
      day: z.string(),
      time: z.string(),
    })
    .nullable(),
});
export type RadarPageData = z.infer<typeof RadarPageDataSchema>;

// --- Signal Detail (01.3) ---

export const ObservedFactSchema = z.object({
  variant: SignalVariantSchema,
  text: z.string(),
});
export type ObservedFact = z.infer<typeof ObservedFactSchema>;

export const SystemLimitationSchema = z.object({
  text: z.string(),
});
export type SystemLimitation = z.infer<typeof SystemLimitationSchema>;

export const SignalDetailSchema = z.object({
  participantId: z.string().uuid(),
  name: z.string(),
  signalType: SignalTypeSchema,
  groupId: z.string().uuid(),
  groupName: z.string(),
  observedFact: ObservedFactSchema,
  systemLimitation: SystemLimitationSchema,
  presenceDots: z.array(PresenceDotSchema),
  lastCareRecord: LastCareRecordSchema.nullable(),
});
export type SignalDetail = z.infer<typeof SignalDetailSchema>;

// --- Participant Profile (01.4) ---

export const RelationalMemorySchema = z.object({
  lastConversation: z
    .object({
      date: z.string().datetime(),
      note: z.string(),
    })
    .nullable(),
  lastPrayer: z
    .object({
      date: z.string().datetime(),
      note: z.string(),
    })
    .nullable(),
  nextMilestone: z
    .object({
      date: z.string().datetime(),
      dayOfWeek: z.string(),
      eventName: z.string(),
    })
    .nullable(),
});
export type RelationalMemory = z.infer<typeof RelationalMemorySchema>;

export const ParticipantProfileSchema = z.object({
  participantId: z.string().uuid(),
  name: z.string(),
  signalType: SignalTypeSchema,
  groupName: z.string(),
  presenceDots: z.array(PresenceDotSchema),
  memory: RelationalMemorySchema,
});
export type ParticipantProfile = z.infer<typeof ParticipantProfileSchema>;

// --- Participant Timeline (Story 6-4) ---

/**
 * Single event in the merged individual timeline.
 * eventType = 'signal'  → presence/attendance event
 * eventType = 'action'  → pastoral care action recorded by leader
 */
export const TimelineEventTypeSchema = z.enum(['signal', 'action']);
export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>;

export const ParticipantTimelineEventSchema = z.object({
  id: z.string().uuid(),
  eventType: TimelineEventTypeSchema,
  /** ISO 8601 — used for chronological sort (descending) */
  occurredAt: z.string().datetime(),
  /** For signal events: presenceType (present | absent | no-meeting) */
  presenceType: z.string().nullable(),
  /** For action events: actionType (message | call | visit | prayer) */
  actionType: z.string().nullable(),
  /** For action events: free-text note (may be null) */
  note: z.string().nullable(),
  /** Human-readable label derived from eventType */
  label: z.string(),
});
export type ParticipantTimelineEvent = z.infer<typeof ParticipantTimelineEventSchema>;

export const ParticipantTimelineSchema = z.object({
  participantId: z.string().uuid(),
  events: z.array(ParticipantTimelineEventSchema),
});
export type ParticipantTimeline = z.infer<typeof ParticipantTimelineSchema>;

// --- Care Action (01.5) ---

export const CareActionRequestSchema = z.object({
  participantId: z.string().uuid(),
  groupId: z.string().uuid(),
  signalType: SignalTypeSchema,
  note: z.string().min(1).max(280),
});
export type CareActionRequest = z.infer<typeof CareActionRequestSchema>;

export const CareActionResponseSchema = z.object({
  careActionId: z.string().uuid(),
  recordedAt: z.string().datetime(),
});
export type CareActionResponse = z.infer<typeof CareActionResponseSchema>;

// --- Pastoral Nudges (Story 6-5) ---

/**
 * Nudge suggestion type:
 *   - 'call'    → 2+ consecutive absences
 *   - 'visit'   → status = vermelho
 *   - 'message' → 7+ days inactive or never active
 */
export const NudgeSuggestionSchema = z.enum(['call', 'visit', 'message']);
export type NudgeSuggestion = z.infer<typeof NudgeSuggestionSchema>;

export const PastoralNudgeSchema = z.object({
  participantId: z.string().uuid(),
  participantName: z.string(),
  groupId: z.string().uuid(),
  suggestion: NudgeSuggestionSchema,
  /** Machine-readable reason code for the nudge trigger */
  reason: z.string(),
});
export type PastoralNudge = z.infer<typeof PastoralNudgeSchema>;

export const NudgeListResponseSchema = z.array(PastoralNudgeSchema);
export type NudgeListResponse = z.infer<typeof NudgeListResponseSchema>;

// --- Status Improved (CelebrationBanner, Story 6-5) ---

export const StatusImprovedItemSchema = z.object({
  id: z.string().uuid(),
  participantId: z.string().uuid(),
  participantName: z.string(),
  previousStatus: z.enum(['verde', 'amarelo', 'vermelho']),
  newStatus: z.enum(['verde', 'amarelo', 'vermelho']),
  trend: z.enum(['melhorando', 'estavel', 'declinio']),
  createdAt: z.string().datetime(),
});
export type StatusImprovedItem = z.infer<typeof StatusImprovedItemSchema>;

export const StatusImprovedListResponseSchema = z.array(StatusImprovedItemSchema);
export type StatusImprovedListResponse = z.infer<typeof StatusImprovedListResponseSchema>;
