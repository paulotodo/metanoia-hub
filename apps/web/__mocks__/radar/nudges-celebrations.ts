import type { PastoralNudge, StatusImprovedItem } from "@metanoia/types";

/** Story 6-5 — mock nudge suggestions for MSW / Storybook */
export const mockNudges: PastoralNudge[] = [
  {
    participantId: "01912345-6789-7000-8000-000000000011",
    participantName: "Ana Lima",
    groupId: "01912345-6789-7000-8000-000000000031",
    suggestion: "visit",
    reason: "status_vermelho",
  },
  {
    participantId: "01912345-6789-7000-8000-000000000012",
    participantName: "Carlos Mendes",
    groupId: "01912345-6789-7000-8000-000000000031",
    suggestion: "call",
    reason: "3_consecutive_absences",
  },
  {
    participantId: "01912345-6789-7000-8000-000000000013",
    participantName: "Beatriz Santos",
    groupId: "01912345-6789-7000-8000-000000000031",
    suggestion: "message",
    reason: "inactive_7d",
  },
];

/** Story 6-5 — mock celebration events for MSW / Storybook */
export const mockCelebrations: StatusImprovedItem[] = [
  {
    id: "01912345-6789-7000-8000-000000000051",
    participantId: "01912345-6789-7000-8000-000000000014",
    participantName: "Pedro Alves",
    previousStatus: "vermelho",
    newStatus: "amarelo",
    trend: "melhorando",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];
