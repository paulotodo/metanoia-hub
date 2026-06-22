import { z } from 'zod';

// ---------------------------------------------------------------------------
// Story 14-4 — Health Check de Integrações & Dashboard Super Admin (NFR-I5)
// Spec §FR-009: schemas compartilhados FE+BE para health check de integrações.
// ---------------------------------------------------------------------------

// --- Status enum ---

export const IntegrationHealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);
export type IntegrationHealthStatus = z.infer<typeof IntegrationHealthStatusSchema>;

// --- Item (resultado por integração) ---

export const IntegrationHealthItemSchema = z.object({
  /** Nome canônico da integração (Resend, Keycloak, MinIO, Redis, PostgreSQL) */
  name: z.string().min(1).max(64),
  status: IntegrationHealthStatusSchema,
  /** Latência medida em milissegundos; null quando erro/timeout antes de resposta */
  latencyMs: z.number().int().nonnegative().nullable(),
  /** ISO 8601 timestamp da verificação */
  lastChecked: z.string().datetime(),
  /**
   * Mensagem opcional da allowlist canônica.
   * NUNCA inclui valores de env vars (RESEND_API_KEY, KEYCLOAK_URL, MINIO_ENDPOINT).
   * CHK028/CHK030: info-disclosure prevention.
   */
  message: z.string().max(200).nullable().optional(),
});
export type IntegrationHealthItem = z.infer<typeof IntegrationHealthItemSchema>;

// --- Summary ---

export const IntegrationHealthSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  healthy: z.number().int().nonnegative(),
  degraded: z.number().int().nonnegative(),
  unhealthy: z.number().int().nonnegative(),
});
export type IntegrationHealthSummary = z.infer<typeof IntegrationHealthSummarySchema>;

// --- Response (GET /api/v1/admin/health/integrations) ---

export const IntegrationHealthResponseSchema = z.object({
  data: z.object({
    integrations: z.array(IntegrationHealthItemSchema),
    summary: IntegrationHealthSummarySchema,
  }),
});
export type IntegrationHealthResponse = z.infer<typeof IntegrationHealthResponseSchema>;

// --- History point (ponto de sparkline 24h) ---

export const IntegrationHealthHistoryPointSchema = z.object({
  /** ISO 8601 timestamp */
  checkedAt: z.string().datetime(),
  status: IntegrationHealthStatusSchema,
  /** null em caso de timeout antes de latência mensurável */
  latencyMs: z.number().int().nonnegative().nullable(),
  message: z.string().max(200).nullable().optional(),
});
export type IntegrationHealthHistoryPoint = z.infer<typeof IntegrationHealthHistoryPointSchema>;

// --- History response (GET /api/v1/admin/health/integrations/history) ---

export const IntegrationHealthHistoryResponseSchema = z.object({
  data: z.object({
    integration: z.string().min(1).max(64),
    points: z.array(IntegrationHealthHistoryPointSchema),
    /** Horas cobertas (param `hours`, default 24, max 72) */
    hours: z.number().int().positive().max(72),
  }),
  meta: z.object({
    total: z.number().int().nonnegative(),
    integration: z.string(),
    hours: z.number(),
  }),
});
export type IntegrationHealthHistoryResponse = z.infer<typeof IntegrationHealthHistoryResponseSchema>;

// --- Query params para history ---

export const IntegrationHealthHistoryQuerySchema = z.object({
  integration: z.enum(['Resend', 'Keycloak', 'MinIO', 'Redis', 'PostgreSQL']),
  hours: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 24))
    .pipe(z.number().int().positive().max(72)),
});
export type IntegrationHealthHistoryQuery = z.infer<typeof IntegrationHealthHistoryQuerySchema>;
