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
    KEYCLOAK_URL: 'http://localhost:8080',
    KEYCLOAK_REALM: 'metanoia',
    KEYCLOAK_CLIENT_ID: 'metanoia-app',
    MINIO_ENDPOINT: 'http://localhost:9000',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET: 'metanoia-storage',
    LIVEKIT_URL: 'ws://localhost:7880',
    LIVEKIT_API_KEY: 'devkey',
    LIVEKIT_API_SECRET: 'secret_dev_only_not_for_production',
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

  it('should apply defaults for Keycloak variables', () => {
    const { KEYCLOAK_URL: _a, KEYCLOAK_REALM: _b, KEYCLOAK_CLIENT_ID: _c, ...withoutKeycloak } = validEnv;
    const result = envSchema.parse(withoutKeycloak);
    expect(result.KEYCLOAK_URL).toBe('http://localhost:8080');
    expect(result.KEYCLOAK_REALM).toBe('metanoia');
    expect(result.KEYCLOAK_CLIENT_ID).toBe('metanoia-app');
  });

  it('should apply defaults for MinIO variables', () => {
    const { MINIO_ENDPOINT: _a, MINIO_ACCESS_KEY: _b, MINIO_SECRET_KEY: _c, MINIO_BUCKET: _d, ...withoutMinio } = validEnv;
    const result = envSchema.parse(withoutMinio);
    expect(result.MINIO_ENDPOINT).toBe('http://localhost:9000');
    expect(result.MINIO_ACCESS_KEY).toBe('minioadmin');
    expect(result.MINIO_SECRET_KEY).toBe('minioadmin');
    expect(result.MINIO_BUCKET).toBe('metanoia-storage');
  });

  it('should apply defaults for LiveKit variables', () => {
    const { LIVEKIT_URL: _a, LIVEKIT_API_KEY: _b, LIVEKIT_API_SECRET: _c, ...withoutLivekit } = validEnv;
    const result = envSchema.parse(withoutLivekit);
    expect(result.LIVEKIT_URL).toBe('ws://localhost:7880');
    expect(result.LIVEKIT_API_KEY).toBe('devkey');
    expect(result.LIVEKIT_API_SECRET).toBe('secret_dev_only_not_for_production');
  });

  it('should reject invalid KEYCLOAK_URL', () => {
    expect(() => envSchema.parse({ ...validEnv, KEYCLOAK_URL: 'not-a-url' })).toThrow();
  });

  it('should reject invalid MINIO_ENDPOINT', () => {
    expect(() => envSchema.parse({ ...validEnv, MINIO_ENDPOINT: 'not-a-url' })).toThrow();
  });
});
