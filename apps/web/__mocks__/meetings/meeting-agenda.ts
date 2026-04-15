/**
 * Mock fixture for Cenário 02.1 — Agenda do grupo.
 * Shape matches `MeetingDetail` from `@metanoia/types`.
 *
 * Session 1 uses this fixture directly (no API client yet).
 * Session 5 migrates consumption to `useMeetingDetail()` via MSW.
 */

import type { MeetingDetail } from "@metanoia/types";

export const mockMeetingAgenda: MeetingDetail = {
  meetingId: "019756c0-0002-7000-8000-000000000101",
  groupId: "019756a1-0001-7000-8000-000000000001",
  groupName: "Jovens Adultos",
  scheduledFor: "2026-04-16T22:30:00.000Z",
  status: "scheduled",
  topic: "Mateus 6 — O que Jesus ensina sobre oração",
  confirmed: [
    {
      participantId: "019756a1-1001-7000-8000-000000000001",
      name: "Pedro Almeida",
      response: "yes",
    },
    {
      participantId: "019756a1-2001-7000-8000-000000000004",
      name: "Mariana Santos",
      response: "yes",
    },
    {
      participantId: "019756a1-3001-7000-8000-000000000007",
      name: "Lucas Mendes",
      response: "yes",
    },
    {
      participantId: "019756a1-1002-7000-8000-000000000002",
      name: "Ana Costa",
      response: "pending",
    },
  ],
  milestones: [
    {
      id: "019756c0-0002-7000-8000-000000000201",
      text: "Retiro de homens dia 20/04",
    },
    {
      id: "019756c0-0002-7000-8000-000000000202",
      text: "Aniversário da Ana na quinta",
    },
  ],
};

export const mockMeetingAgendaEmpty: MeetingDetail = {
  ...mockMeetingAgenda,
  meetingId: "019756c0-0002-7000-8000-000000000102",
  topic: null,
  confirmed: [],
  milestones: [],
};

export const mockMeetingAgendaLive: MeetingDetail = {
  ...mockMeetingAgenda,
  meetingId: "019756c0-0002-7000-8000-000000000103",
  status: "live",
};
