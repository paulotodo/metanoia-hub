import { z } from 'zod';

// --- Reflection (02.3) ---

export const CreateReflectionInputSchema = z.object({
  text: z.string().min(1).max(280),
});
export type CreateReflectionInput = z.infer<typeof CreateReflectionInputSchema>;

export const ReflectionSchema = z.object({
  reflectionId: z.string().uuid(),
  meetingId: z.string().uuid(),
  leaderId: z.string().uuid(),
  text: z.string(),
  recordedAt: z.string().datetime(),
});
export type Reflection = z.infer<typeof ReflectionSchema>;

export const CreateReflectionResponseSchema = z.object({
  reflectionId: z.string().uuid(),
  recordedAt: z.string().datetime(),
});
export type CreateReflectionResponse = z.infer<
  typeof CreateReflectionResponseSchema
>;
