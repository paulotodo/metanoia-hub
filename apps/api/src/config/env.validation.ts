import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().url(),
  DATABASE_APP_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    throw new Error(
      `Environment validation failed:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }
  return result.data;
}
