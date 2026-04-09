import { describe, it, expect } from 'vitest';
import { envSchema } from '../env.validation';

describe('envSchema', () => {
  const validEnv = {
    NODE_ENV: 'development',
    API_PORT: '3001',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    DATABASE_APP_URL: 'postgresql://app:pass@localhost:5432/db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
  };

  it('should validate a complete env', () => {
    const result = envSchema.parse(validEnv);
    expect(result.API_PORT).toBe(3001);
  });

  it('should fail if DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...incomplete } = validEnv;
    expect(() => envSchema.parse(incomplete)).toThrow();
  });

  it('should fail if DATABASE_APP_URL is missing', () => {
    const { DATABASE_APP_URL: _, ...incomplete } = validEnv;
    expect(() => envSchema.parse(incomplete)).toThrow();
  });

  it('should apply default API_PORT', () => {
    const { API_PORT: _, ...withoutPort } = validEnv;
    const result = envSchema.parse(withoutPort);
    expect(result.API_PORT).toBe(3001);
  });
});
