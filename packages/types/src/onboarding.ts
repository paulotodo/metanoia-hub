import { z } from 'zod';

// --- Demo radar signal ---

export const DemoRadarSignalSchema = z.enum([
  'care-urgent',
  'care-attention',
  'care-ok',
]);
export type DemoRadarSignal = z.infer<typeof DemoRadarSignalSchema>;

// --- Demo radar participant ---
// Backend returns i18n keys; FE resolves them via messages/pt-BR.json.

export const DemoRadarParticipantSchema = z.object({
  nameKey: z.string().min(1),
  signalType: DemoRadarSignalSchema,
  contextPhraseKey: z.string().min(1),
});
export type DemoRadarParticipant = z.infer<typeof DemoRadarParticipantSchema>;

// --- GET /api/v1/onboarding/demo-radar ---

export const DemoRadarResponseSchema = z.object({
  tenantId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  isDemo: z.literal(true),
  groupNameKey: z.string().min(1),
  messageKey: z.string().min(1),
  participants: z.array(DemoRadarParticipantSchema),
  signals: z.array(DemoRadarSignalSchema),
});
export type DemoRadarResponse = z.infer<typeof DemoRadarResponseSchema>;
