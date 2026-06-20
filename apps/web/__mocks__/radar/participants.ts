/**
 * Mock data fixtures for Radar Pastoral prototype (Session 0).
 * Shape derived from spec 01.2-tela-principal-lider.
 *
 * These fixtures simulate the API response for `useRadarSignals`.
 * Each participant has a signalType that maps to a semáforo state.
 */

export type SignalType = "care-urgent" | "care-attention" | "care-ok";

export type PresenceDot = "present" | "absent" | "no-meeting";

export type RiskReason = "absences" | "inactivity" | "absences+inactivity";

export interface RadarParticipant {
  participantId: string;
  name: string;
  signalType: SignalType;
  contextPhrase: string | null;
  groupId: string;
  groupName: string;
  presenceDots: PresenceDot[];
  lastCareRecord: {
    date: string; // ISO 8601
    type: "message" | "call" | "visit" | "prayer";
  } | null;
  /** Risk reason from evasion detection (FR66). Null when no active risk. */
  riskReason?: RiskReason | null;
}

export interface RadarGroup {
  id: string;
  name: string;
}

export interface RadarSignalCounts {
  careUrgent: number;
  careAttention: number;
  careOk: number;
  deltaUrgent: number;
  deltaAttention: number;
  deltaOk: number;
}

export interface RadarPageData {
  participants: RadarParticipant[];
  groups: RadarGroup[];
  signalCounts: RadarSignalCounts;
  userFirstName: string;
  lastSeenAt: string | null; // ISO 8601 — triggers ReturnBanner if >5 days
  nextMeeting: { day: string; time: string } | null;
}

// --- Mock Groups ---

export const mockGroups: RadarGroup[] = [
  { id: "019756a1-0001-7000-8000-000000000001", name: "Jovens Adultos" },
  { id: "019756a1-0002-7000-8000-000000000002", name: "Casais" },
];

// --- Mock Participants ---

export const mockParticipants: RadarParticipant[] = [
  // care-urgent (3)
  {
    participantId: "019756a1-1001-7000-8000-000000000001",
    name: "Pedro Almeida",
    signalType: "care-urgent",
    contextPhrase: "Faz 3 semanas que não aparece",
    groupId: mockGroups[0].id,
    groupName: mockGroups[0].name,
    presenceDots: ["present", "present", "absent", "absent", "absent"],
    lastCareRecord: {
      date: "2026-03-20T10:30:00Z",
      type: "message",
    },
  },
  {
    participantId: "019756a1-1002-7000-8000-000000000002",
    name: "Ana Costa",
    signalType: "care-urgent",
    contextPhrase: "Saiu cedo nas últimas 2 reuniões",
    groupId: mockGroups[0].id,
    groupName: mockGroups[0].name,
    presenceDots: ["present", "present", "present", "present", "absent"],
    lastCareRecord: null,
  },
  {
    participantId: "019756a1-1003-7000-8000-000000000003",
    name: "Carlos Ferreira",
    signalType: "care-urgent",
    contextPhrase: "Participação em queda nas últimas 4 semanas",
    groupId: mockGroups[1].id,
    groupName: mockGroups[1].name,
    presenceDots: ["present", "present", "absent", "absent", "absent"],
    lastCareRecord: {
      date: "2026-03-10T14:00:00Z",
      type: "call",
    },
  },

  // care-attention (3)
  {
    participantId: "019756a1-2001-7000-8000-000000000004",
    name: "Mariana Santos",
    signalType: "care-attention",
    contextPhrase: "Faltou na última reunião",
    groupId: mockGroups[0].id,
    groupName: mockGroups[0].name,
    presenceDots: ["present", "present", "present", "absent", "no-meeting"],
    lastCareRecord: {
      date: "2026-04-01T09:00:00Z",
      type: "prayer",
    },
  },
  {
    participantId: "019756a1-2002-7000-8000-000000000005",
    name: "Rafael Oliveira",
    signalType: "care-attention",
    contextPhrase: "Não confirmou presença esta semana",
    groupId: mockGroups[1].id,
    groupName: mockGroups[1].name,
    presenceDots: ["present", "absent", "present", "present", "present"],
    lastCareRecord: null,
  },
  {
    participantId: "019756a1-2003-7000-8000-000000000006",
    name: "Juliana Lima",
    signalType: "care-attention",
    contextPhrase: null,
    groupId: mockGroups[0].id,
    groupName: mockGroups[0].name,
    presenceDots: ["present", "present", "absent", "present", "present"],
    lastCareRecord: {
      date: "2026-04-05T16:30:00Z",
      type: "visit",
    },
  },

  // care-ok (4)
  {
    participantId: "019756a1-3001-7000-8000-000000000007",
    name: "Lucas Mendes",
    signalType: "care-ok",
    contextPhrase: null,
    groupId: mockGroups[0].id,
    groupName: mockGroups[0].name,
    presenceDots: ["present", "present", "present", "present", "present"],
    lastCareRecord: null,
  },
  {
    participantId: "019756a1-3002-7000-8000-000000000008",
    name: "Beatriz Souza",
    signalType: "care-ok",
    contextPhrase: null,
    groupId: mockGroups[1].id,
    groupName: mockGroups[1].name,
    presenceDots: ["present", "present", "present", "present", "absent"],
    lastCareRecord: null,
  },
  {
    participantId: "019756a1-3003-7000-8000-000000000009",
    name: "Thiago Rocha",
    signalType: "care-ok",
    contextPhrase: null,
    groupId: mockGroups[1].id,
    groupName: mockGroups[1].name,
    presenceDots: ["present", "present", "present", "present", "present"],
    lastCareRecord: null,
  },
  {
    participantId: "019756a1-3004-7000-8000-000000000010",
    name: "Camila Araújo",
    signalType: "care-ok",
    contextPhrase: null,
    groupId: mockGroups[0].id,
    groupName: mockGroups[0].name,
    presenceDots: ["present", "absent", "present", "present", "present"],
    lastCareRecord: {
      date: "2026-04-10T11:00:00Z",
      type: "message",
    },
  },
];

// --- Computed Signal Counts ---

function computeSignalCounts(
  participants: RadarParticipant[],
): RadarSignalCounts {
  const careUrgent = participants.filter(
    (p) => p.signalType === "care-urgent",
  ).length;
  const careAttention = participants.filter(
    (p) => p.signalType === "care-attention",
  ).length;
  const careOk = participants.filter(
    (p) => p.signalType === "care-ok",
  ).length;

  return {
    careUrgent,
    careAttention,
    careOk,
    deltaUrgent: 1,
    deltaAttention: 0,
    deltaOk: 0,
  };
}

// --- Full Page Data ---

export const mockRadarPageData: RadarPageData = {
  participants: mockParticipants,
  groups: mockGroups,
  signalCounts: computeSignalCounts(mockParticipants),
  userFirstName: "Marcos",
  lastSeenAt: "2026-04-12T08:00:00Z", // yesterday — no ReturnBanner
  nextMeeting: { day: "quinta", time: "19:30" },
};

// --- Variant: ReturnBanner state (lastSeenAt >5 days ago) ---

export const mockRadarReturnData: RadarPageData = {
  ...mockRadarPageData,
  lastSeenAt: "2026-04-05T08:00:00Z", // 8 days ago — triggers ReturnBanner
};

// --- Variant: Inbox Zero state ---

export const mockRadarInboxZeroData: RadarPageData = {
  ...mockRadarPageData,
  participants: mockParticipants.filter((p) => p.signalType === "care-ok"),
  signalCounts: {
    careUrgent: 0,
    careAttention: 0,
    careOk: 4,
    deltaUrgent: 0,
    deltaAttention: 0,
    deltaOk: 0,
  },
};

// --- Variant: Empty (no groups) ---

export const mockRadarEmptyData: RadarPageData = {
  ...mockRadarPageData,
  participants: [],
  groups: [],
  signalCounts: {
    careUrgent: 0,
    careAttention: 0,
    careOk: 0,
    deltaUrgent: 0,
    deltaAttention: 0,
    deltaOk: 0,
  },
};
