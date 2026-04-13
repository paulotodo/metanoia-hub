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
