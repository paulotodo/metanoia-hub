import { z } from 'zod';

// --- Enums ---

export const MeetingStatusSchema = z.enum([
  'scheduled',
  'live',
  'ended',
  'cancelled',
]);
export type MeetingStatus = z.infer<typeof MeetingStatusSchema>;

export const ConfirmedResponseSchema = z.enum([
  'yes',
  'no',
  'pending',
]);
export type ConfirmedResponse = z.infer<typeof ConfirmedResponseSchema>;

// --- Sub-schemas ---

export const ConfirmedParticipantSchema = z.object({
  participantId: z.string().uuid(),
  name: z.string(),
  response: ConfirmedResponseSchema,
});
export type ConfirmedParticipant = z.infer<typeof ConfirmedParticipantSchema>;

export const MeetingMilestoneSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
});
export type MeetingMilestone = z.infer<typeof MeetingMilestoneSchema>;

// --- Meeting Detail (02.1) ---

export const MeetingDetailSchema = z.object({
  meetingId: z.string().uuid(),
  groupId: z.string().uuid(),
  groupName: z.string(),
  scheduledFor: z.string().datetime(),
  status: MeetingStatusSchema,
  topic: z.string().nullable(),
  confirmed: z.array(ConfirmedParticipantSchema),
  milestones: z.array(MeetingMilestoneSchema),
});
export type MeetingDetail = z.infer<typeof MeetingDetailSchema>;

// --- Live presence (02.2) ---

export const MeetingParticipantSchema = z.object({
  participantId: z.string().uuid(),
  name: z.string(),
  joinedAt: z.string().datetime().nullable(),
  leftAt: z.string().datetime().nullable(),
});
export type MeetingParticipant = z.infer<typeof MeetingParticipantSchema>;

// --- Room open/end (02.1 → 02.2) ---

export const OpenRoomResponseSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  joinToken: z.string(),
  livekitUrl: z.string(),
  startedAt: z.string().datetime(),
});
export type OpenRoomResponse = z.infer<typeof OpenRoomResponseSchema>;

export const EndRoomResponseSchema = z.object({
  meetingId: z.string().uuid(),
  endedAt: z.string().datetime(),
});
export type EndRoomResponse = z.infer<typeof EndRoomResponseSchema>;

// --- Story 5.1 CRUD contracts -----------------------------------------------

export const MeetingResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  groupId: z.string().uuid(),
  title: z.string().nullable(),
  scheduledFor: z.string().datetime(),
  durationMinutes: z.number().int().positive().nullable(),
  status: MeetingStatusSchema,
  topic: z.string().nullable(),
  providerRoomId: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MeetingResponse = z.infer<typeof MeetingResponseSchema>;

export const CreateMeetingRequestSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  scheduledFor: z.string().datetime(),
  durationMinutes: z.number().int().positive().max(720).optional(),
  topic: z.string().max(500).optional(),
});
export type CreateMeetingRequest = z.infer<typeof CreateMeetingRequestSchema>;

export const UpdateMeetingRequestSchema = z
  .object({
    title: z.string().min(1).max(200).nullable().optional(),
    scheduledFor: z.string().datetime().optional(),
    durationMinutes: z.number().int().positive().max(720).nullable().optional(),
    topic: z.string().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at_least_one_field_required',
  });
export type UpdateMeetingRequest = z.infer<typeof UpdateMeetingRequestSchema>;

const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const MeetingsListResponseSchema = z.object({
  data: z.array(MeetingResponseSchema),
  meta: PaginationMetaSchema,
});
export type MeetingsListResponse = z.infer<typeof MeetingsListResponseSchema>;

export const MeetingsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: MeetingStatusSchema.optional(),
  groupId: z.string().uuid().optional(),
});
export type MeetingsListQuery = z.infer<typeof MeetingsListQuerySchema>;

export const JoinMeetingResponseSchema = z.object({
  meetingId: z.string().uuid(),
  roomName: z.string(),
  joinToken: z.string(),
  livekitUrl: z.string(),
});
export type JoinMeetingResponse = z.infer<typeof JoinMeetingResponseSchema>;
