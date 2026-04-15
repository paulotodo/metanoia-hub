import { z } from 'zod';

// --- Status agregado por grupo (vista 03.2) ---

export const PastoralStatusSchema = z.enum([
  'healthy',
  'attention',
  'call',
  'no-signal',
]);
export type PastoralStatus = z.infer<typeof PastoralStatusSchema>;

export const GroupCardSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string(),
  leaderId: z.string().uuid(),
  leaderName: z.string(),
  status: PastoralStatusSchema,
  statusPhrase: z.string(),
  lastMeetingAt: z.string().datetime().nullable(),
  memberCount: z.number().int().min(0),
});
export type GroupCard = z.infer<typeof GroupCardSchema>;

export const ChurchOverviewMetaSchema = z.object({
  lastCalculatedAt: z.string().datetime(),
  groupCount: z.number().int().min(0),
});
export type ChurchOverviewMeta = z.infer<typeof ChurchOverviewMetaSchema>;

export const ChurchOverviewResponseSchema = z.object({
  data: z.array(GroupCardSchema),
  meta: ChurchOverviewMetaSchema,
});
export type ChurchOverviewResponse = z.infer<
  typeof ChurchOverviewResponseSchema
>;

// --- Drill-down de grupo (03.3) ---

export const GroupHeaderSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string(),
  leaderId: z.string().uuid(),
  leaderName: z.string(),
  schedule: z.string(),
  location: z.string(),
  memberCount: z.number().int().min(0),
  status: PastoralStatusSchema,
  statusPhrase: z.string(),
});
export type GroupHeader = z.infer<typeof GroupHeaderSchema>;

const TimelineEntryBaseSchema = z.object({
  entryId: z.string().uuid(),
  occurredAt: z.string().datetime(),
});

export const MeetingTimelineEntrySchema = TimelineEntryBaseSchema.extend({
  type: z.literal('meeting'),
  presentCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  reflectionText: z.string().nullable(),
});
export type MeetingTimelineEntry = z.infer<typeof MeetingTimelineEntrySchema>;

export const CareTimelineEntrySchema = TimelineEntryBaseSchema.extend({
  type: z.literal('care'),
  participantName: z.string(),
  signalStatus: z.enum(['care-urgent', 'care-attention', 'care-ok']),
  careNote: z.string(),
});
export type CareTimelineEntry = z.infer<typeof CareTimelineEntrySchema>;

export const TimelineEntrySchema = z.discriminatedUnion('type', [
  MeetingTimelineEntrySchema,
  CareTimelineEntrySchema,
]);
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const GroupTimelineMetaSchema = z.object({
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
});
export type GroupTimelineMeta = z.infer<typeof GroupTimelineMetaSchema>;

export const GroupTimelineResponseSchema = z.object({
  data: z.object({
    group: GroupHeaderSchema,
    entries: z.array(TimelineEntrySchema),
  }),
  meta: GroupTimelineMetaSchema,
});
export type GroupTimelineResponse = z.infer<typeof GroupTimelineResponseSchema>;

// --- Perfil do líder + intent (03.4) ---

export const LeaderProfileSchema = z.object({
  leaderId: z.string().uuid(),
  firstName: z.string(),
  fullName: z.string(),
  groupName: z.string(),
  tenure: z.string(),
});
export type LeaderProfile = z.infer<typeof LeaderProfileSchema>;

export const PastoralConversationSchema = z.object({
  conversationId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  note: z.string(),
});
export type PastoralConversation = z.infer<typeof PastoralConversationSchema>;

export const ActivityEntrySchema = z.object({
  entryId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  description: z.string(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

export const OutreachIntentSchema = z.object({
  intentId: z.string().uuid(),
  targetLeaderId: z.string().uuid(),
  weekOf: z.string().datetime(),
  note: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OutreachIntent = z.infer<typeof OutreachIntentSchema>;

export const LeaderViewResponseSchema = z.object({
  data: z.object({
    leader: LeaderProfileSchema,
    lastConversation: PastoralConversationSchema.nullable(),
    recentActivity: z.array(ActivityEntrySchema),
    currentWeekIntent: OutreachIntentSchema.nullable(),
  }),
});
export type LeaderViewResponse = z.infer<typeof LeaderViewResponseSchema>;

export const CreateOutreachIntentRequestSchema = z.object({
  targetLeaderId: z.string().uuid(),
  weekOf: z.string().datetime(),
  note: z.string().min(1).max(280),
});
export type CreateOutreachIntentRequest = z.infer<
  typeof CreateOutreachIntentRequestSchema
>;

export const UpdateOutreachIntentRequestSchema = z.object({
  note: z.string().min(1).max(280),
});
export type UpdateOutreachIntentRequest = z.infer<
  typeof UpdateOutreachIntentRequestSchema
>;

export const OutreachIntentResponseSchema = z.object({
  data: OutreachIntentSchema,
});
export type OutreachIntentResponse = z.infer<
  typeof OutreachIntentResponseSchema
>;
