import { z } from 'zod';
import { IntegrationHealthHistoryQuerySchema } from '@metanoia/types';

/**
 * DTO para query params de GET /api/v1/admin/health/integrations/history.
 * Validado por ZodValidationPipe conforme CLAUDE.md (nunca nestjs-zod).
 *
 * Story 14-4 §FR-004, §NFR-SEC-002.
 * Retorna 400/422 para params inválidos (CHK009).
 */
export const IntegrationHistoryQueryDtoSchema = IntegrationHealthHistoryQuerySchema;
export type IntegrationHistoryQueryDto = z.infer<typeof IntegrationHistoryQueryDtoSchema>;
