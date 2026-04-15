import { z } from 'zod';

// --- Enums ---

export const MeetingStatusSchema = z.enum([
  'scheduled',
  'live',
  'ended',
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
