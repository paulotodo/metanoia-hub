import { z } from 'zod';
import { LoginResponseSchema } from './login';

export const ForgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ForgotPasswordResponseSchema = z.object({
  data: z.object({
    message: z.string(),
  }),
});

export type ForgotPasswordResponse = z.infer<typeof ForgotPasswordResponseSchema>;

export const ResetTokenValidateResponseSchema = z.object({
  data: z.object({
    valid: z.literal(true),
    email: z.string(),
  }),
});

export type ResetTokenValidateResponse = z.infer<typeof ResetTokenValidateResponseSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().uuid(),
    newPassword: z.string().min(8).max(64),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const ResetPasswordResponseSchema = z.object({
  data: LoginResponseSchema,
});

export type ResetPasswordResponse = z.infer<typeof ResetPasswordResponseSchema>;
