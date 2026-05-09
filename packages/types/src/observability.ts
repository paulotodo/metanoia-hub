import { z } from 'zod';

/**
 * Payload sent by the frontend error boundary to report a client-side
 * crash to the API, which forwards it to Sentry.
 *
 * Kept minimal on purpose — we never want PII (names, emails, payloads)
 * leaking through this channel. Only IDs (which Sentry can correlate to
 * the existing user context tags) and route are accepted.
 */
export const ClientErrorReportSchema = z.object({
  errorName: z.string().min(1).max(120),
  message: z.string().min(1).max(500),
  statusCode: z.number().int().min(100).max(599).optional(),
  route: z.string().max(500).optional(),
  componentStack: z.string().max(2_000).optional(),
  digest: z.string().max(120).optional(),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),
});

export type ClientErrorReport = z.infer<typeof ClientErrorReportSchema>;
