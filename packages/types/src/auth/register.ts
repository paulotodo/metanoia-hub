import { z } from 'zod';

export const RegisterUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(64),
  name: z.string().min(1).max(255).trim(),
});

export type RegisterUser = z.infer<typeof RegisterUserSchema>;

export const RegisterUserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  status: z.string(),
});

export type RegisterUserResponse = z.infer<typeof RegisterUserResponseSchema>;
