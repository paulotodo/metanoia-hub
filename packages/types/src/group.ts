import { z } from 'zod';

// --- Day of week (short form, pastoral vocabulary) ---

export const DayOfWeekSchema = z.enum([
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

// --- Recurrence ---

export const GroupRecurrenceSchema = z.enum(['weekly', 'biweekly', 'monthly']);
export type GroupRecurrence = z.infer<typeof GroupRecurrenceSchema>;

// --- POST /api/v1/groups ---

const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const CreateGroupRequestSchema = z.object({
  name: z.string().min(2).max(120),
  dayOfWeek: DayOfWeekSchema,
  time: z.string().regex(TIME_HH_MM_REGEX, 'Time must be in HH:MM format'),
  recurrence: GroupRecurrenceSchema.optional(),
  notes: z.string().max(500).optional(),
});
export type CreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const GroupResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  dayOfWeek: DayOfWeekSchema,
  time: z.string().regex(TIME_HH_MM_REGEX),
  recurrence: GroupRecurrenceSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GroupResponse = z.infer<typeof GroupResponseSchema>;
