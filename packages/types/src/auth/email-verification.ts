import { z } from 'zod';

/** Body for confirming a registration via the emailed token. */
export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export const VerifyEmailResponseSchema = z.object({
  verified: z.literal(true),
  email: z.string().email(),
});

export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>;

/** Body for requesting a new verification email (anti-enumeration). */
export const ResendVerificationSchema = z.object({
  email: z.string().email().max(255),
});

export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;

export const ResendVerificationResponseSchema = z.object({
  message: z.string(),
});

export type ResendVerificationResponse = z.infer<
  typeof ResendVerificationResponseSchema
>;
