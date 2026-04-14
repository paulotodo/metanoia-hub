import { z } from 'zod';

// Shape derived from apps/web/__mocks__/onboarding/onboarding.ts to keep FE parity.

// --- Demo radar signal ---

export const DemoRadarSignalSchema = z.enum([
  'care-urgent',
  'care-attention',
  'care-ok',
]);
export type DemoRadarSignal = z.infer<typeof DemoRadarSignalSchema>;

// --- Demo radar participant ---

export const DemoRadarParticipantSchema = z.object({
  name: z.string(),
  signalType: DemoRadarSignalSchema,
  contextPhrase: z.string(),
});
export type DemoRadarParticipant = z.infer<typeof DemoRadarParticipantSchema>;

// --- GET /api/v1/onboarding/demo-radar ---

export const DemoRadarResponseSchema = z.object({
  tenantId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  isDemo: z.literal(true),
  groupName: z.string(),
  message: z.string(),
  participants: z.array(DemoRadarParticipantSchema),
  signals: z.array(DemoRadarSignalSchema),
});
export type DemoRadarResponse = z.infer<typeof DemoRadarResponseSchema>;
