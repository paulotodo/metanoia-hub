import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(64),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  sessionId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    hasConsent: z.boolean(),
    tenants: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        role: z.string(),
      }),
    ),
  }),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
