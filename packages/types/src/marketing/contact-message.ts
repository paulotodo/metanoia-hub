import { z } from 'zod';

export const ContactMessageInputSchema = z.object({
  fullName: z.string().min(1).max(120).trim(),
  email: z.string().email().max(255),
  message: z.string().min(1).max(2000).trim(),
});
export type ContactMessageInput = z.infer<typeof ContactMessageInputSchema>;

export const ContactMessageRecordSchema = ContactMessageInputSchema.extend({
  contactMessageId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type ContactMessageRecord = z.infer<typeof ContactMessageRecordSchema>;

export const ContactMessageResponseSchema = z.object({
  data: ContactMessageRecordSchema,
});
export type ContactMessageResponse = z.infer<
  typeof ContactMessageResponseSchema
>;
