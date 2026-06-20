import { z } from 'zod';

// --- Valores semânticos de riskReason ---
export const ParticipantRiskReasonSchema = z.enum([
  'absences',
  'inactivity',
  'absences+inactivity',
]);
export type ParticipantRiskReason = z.infer<typeof ParticipantRiskReasonSchema>;

// --- Domain Event: risk-detected ---
export const RiskDetectedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('pastoral.participant.risk-detected'),
  version: z.literal(1),
  tenantId: z.string().uuid(),
  timestamp: z.string().datetime(),
  data: z.object({
    participantId: z.string().uuid(),
    groupId: z.string().uuid(),
    riskReason: ParticipantRiskReasonSchema,
    status: z.enum(['amarelo', 'vermelho']),
    detectedAt: z.string().datetime(),
  }),
  metadata: z
    .object({
      source: z.literal('detect-evasion-risk').optional(),
      jobRunId: z.string().uuid().optional(),
    })
    .optional(),
});
export type RiskDetectedEvent = z.infer<typeof RiskDetectedEventSchema>;

// --- Domain Event: risk-resolved ---
export const RiskResolvedEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('pastoral.participant.risk-resolved'),
  version: z.literal(1),
  tenantId: z.string().uuid(),
  timestamp: z.string().datetime(),
  data: z.object({
    participantId: z.string().uuid(),
    groupId: z.string().uuid(),
    previousStatus: z.enum(['amarelo', 'vermelho']),
    resolvedAt: z.string().datetime(),
  }),
  metadata: z
    .object({
      source: z.literal('detect-evasion-risk').optional(),
      jobRunId: z.string().uuid().optional(),
    })
    .optional(),
});
export type RiskResolvedEvent = z.infer<typeof RiskResolvedEventSchema>;
