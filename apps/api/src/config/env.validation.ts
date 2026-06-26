import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().url(),
  DATABASE_APP_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  // Internal URL the API uses to fetch JWKS (server-to-server).
  KEYCLOAK_URL: z.string().url().default('http://localhost:8080'),
  // Public URL Keycloak embeds as the token `iss` (KC_HOSTNAME_URL). Token
  // issuer is validated against this; JWKS is still fetched over KEYCLOAK_URL.
  KEYCLOAK_PUBLIC_URL: z.string().url().default('http://localhost:8080'),
  KEYCLOAK_REALM: z.string().default('metanoia'),
  KEYCLOAK_CLIENT_ID: z.string().default('metanoia-web'),
  KEYCLOAK_API_CLIENT_ID: z.string().default('metanoia-api'),
  KEYCLOAK_API_CLIENT_SECRET: z.string().default('dev-secret-only-not-for-production'),
  KEYCLOAK_EXPECTED_AUDIENCE: z.string().min(1).default('metanoia-api'),
  MINIO_ENDPOINT: z.string().url().default('http://localhost:9000'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('metanoia-storage'),
  // Internal URL the API uses to manage rooms (server-side RoomServiceClient).
  LIVEKIT_URL: z.string().default('ws://localhost:7880'),
  // Public signaling URL handed to the browser (wss via reverse proxy). The
  // client connects here, then media flows over UDP to the advertised IP.
  LIVEKIT_PUBLIC_URL: z.string().default('ws://localhost:7880'),
  LIVEKIT_API_KEY: z.string().default('devkey'),
  LIVEKIT_API_SECRET: z.string().default('secret_dev_only_not_for_production'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  // Treat an empty string as unset. docker-compose injects `SENTRY_DSN=` when the
  // var is not configured, which would otherwise fail .url() and block boot.
  SENTRY_DSN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  NOTIFICATION_DIGEST_WINDOW_MS: z.coerce.number().int().positive().default(300000),
  // SSE (Server-Sent Events) configuration
  SSE_MAX_CONNECTIONS: z.coerce
    .number()
    .int()
    .min(1)
    .default(1000)
    .transform((v) => (v <= 0 ? 1000 : v)),
  SSE_MAX_PER_USER: z.coerce
    .number()
    .int()
    .min(1)
    .default(5)
    .transform((v) => (v <= 0 ? 5 : v)),
  SSE_HEARTBEAT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(30000),
  // ── Email (Story 14-3 / FR77) ─────────────────────────────────────────────
  // RESEND_API_KEY: required in production; no default (explicit startup failure).
  // SECURITY: never logged — CHK029/L1. EmailService.send() NEVER logs html body.
  RESEND_API_KEY: z.string().min(1),
  EMAIL_DEFAULT_FROM: z.string().default('Metanoia <notifications@metanoia.app>'),
  EMAIL_DAILY_LIMIT: z.coerce.number().int().positive().default(100),
  EMAIL_RATE_THRESHOLD: z.coerce.number().int().positive().default(80),
  // Retry backoff for critical notifications (pastoral_alert, export_ready, system).
  // SC-01: delivery <= 1 min -> 3 retries * 5s = max 15s (CHK050).
  EMAIL_CRITICAL_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
  // ── OpenTelemetry Tracing (NFR-O5 / tracing-distribuido-opentelemetry) ──────
  // All OTEL_* vars are optional. When OTEL_EXPORTER_OTLP_ENDPOINT is absent
  // the SDK enters no-op mode — no network socket opened, no exception (FR-01/02).
  // Lição 14-3: env vars sem default travam boot; todas têm defaults seguros.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  OTEL_SERVICE_NAME: z.string().min(1).default('metanoia-api'),
  OTEL_TRACES_EXPORTER: z.enum(['otlp', 'console', 'none']).default('otlp'),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).optional(),
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
