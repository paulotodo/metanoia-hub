import { z } from 'zod';

/** Response shape for a single pastoral alert (status-transition type). */
export const AlertResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  groupId: z.string().uuid(),
  participantId: z.string().uuid(),
  previousStatus: z.enum(['verde', 'amarelo', 'vermelho']).nullable(),
  newStatus: z.enum(['verde', 'amarelo', 'vermelho']).nullable(),
  trend: z.enum(['melhorando', 'estavel', 'declinio']).nullable(),
  readAt: z.string().datetime().nullable(),
  dismissedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type AlertResponse = z.infer<typeof AlertResponseSchema>;
