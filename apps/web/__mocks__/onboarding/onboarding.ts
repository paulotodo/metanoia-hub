/**
 * Mock fixtures for post-auth onboarding pages (05.4 boas-vindas, 05.5 criar primeiro grupo).
 * Shape mirrors the shared Zod schemas in `@metanoia/types`:
 *   - DemoRadarResponseSchema (onboarding.ts)
 *   - CreateGroupRequestSchema / GroupResponseSchema (group.ts)
 * User-facing strings live as i18n keys; FE resolves them via `apps/web/messages/pt-BR.json`.
 */

import type {
  DemoRadarResponse,
  DemoRadarSignal,
} from "@metanoia/types";

export type { DemoRadarResponse, DemoRadarSignal };

export const mockDemoRadar: DemoRadarResponse = {
  tenantId: "019756c0-0001-7000-8000-000000000001",
  generatedAt: "2026-04-13T12:00:00.000Z",
  isDemo: true,
  groupNameKey: "welcome.demo.groupName",
  messageKey: "welcome.demo.message",
  participants: [
    {
      nameKey: "welcome.demo.card1.name",
      signalType: "care-ok",
      contextPhraseKey: "welcome.demo.card1.signal",
    },
    {
      nameKey: "welcome.demo.card2.name",
      signalType: "care-attention",
      contextPhraseKey: "welcome.demo.card2.signal",
    },
    {
      nameKey: "welcome.demo.card3.name",
      signalType: "care-urgent",
      contextPhraseKey: "welcome.demo.card3.signal",
    },
  ],
  signals: ["care-attention", "care-urgent"],
};

// --- POST /api/v1/groups (form shape for the 05.5 page) ---

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface CreateGroupFormValues {
  name: string;
  description?: string;
  dayOfWeek?: DayOfWeek;
  /** 24h "HH:mm". */
  timeOfDay?: string;
  addSelfAsParticipant: boolean;
}
