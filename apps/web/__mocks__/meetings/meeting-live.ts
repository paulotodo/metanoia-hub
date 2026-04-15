/**
 * Mock fixture for Cenário 02.2 — Sala ao vivo (presença).
 * Session 2 consumes directly; Session 5 migrates to SSE stream via MSW.
 */

import type { MeetingParticipant } from "@metanoia/types";

export const mockLiveParticipants: MeetingParticipant[] = [
  {
    participantId: "019756a1-1001-7000-8000-000000000001",
    name: "Pedro Almeida",
    joinedAt: "2026-04-16T22:31:12.000Z",
    leftAt: null,
  },
  {
    participantId: "019756a1-2001-7000-8000-000000000004",
    name: "Mariana Santos",
    joinedAt: "2026-04-16T22:32:04.000Z",
    leftAt: null,
  },
  {
    participantId: "019756a1-3001-7000-8000-000000000007",
    name: "Lucas Mendes",
    joinedAt: "2026-04-16T22:33:18.000Z",
    leftAt: "2026-04-16T22:58:02.000Z",
  },
  {
    participantId: "019756a1-1002-7000-8000-000000000002",
    name: "Ana Costa",
    joinedAt: null,
    leftAt: null,
  },
];

export const mockLiveParticipantsEmpty: MeetingParticipant[] = [];

export const mockRoomStartedAt = "2026-04-16T22:30:00.000Z";
