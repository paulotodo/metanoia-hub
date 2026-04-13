/**
 * Mock data fixtures for pages 01.3, 01.4, 01.5 (signal detail, profile, care action).
 * Shape derived from specs 01.3/01.4/01.5.
 */

import type { PresenceDot, SignalType } from "./participants";

// --- 01.3 Signal Detail ---

export interface ObservedFact {
  variant: "absence" | "early-exit" | "decline" | "post-event" | "fallback";
  text: string;
}

export interface SystemLimitation {
  text: string;
}

export interface SignalDetail {
  participantId: string;
  name: string;
  signalType: SignalType;
  groupName: string;
  observedFact: ObservedFact;
  systemLimitation: SystemLimitation;
  presenceDots: PresenceDot[];
  lastCareRecord: {
    date: string;
    type: "message" | "call" | "visit" | "prayer";
  } | null;
}

// --- 01.4 Participant Profile ---

export interface RelationalMemory {
  lastConversation: { date: string; note: string } | null;
  lastPrayer: { date: string; note: string } | null;
  nextMilestone: {
    date: string;
    dayOfWeek: string;
    eventName: string;
  } | null;
}

export interface ParticipantProfile {
  participantId: string;
  name: string;
  signalType: SignalType;
  groupName: string;
  presenceDots: PresenceDot[];
  memory: RelationalMemory;
}

// --- 01.5 Care Action ---

export interface CareActionRequest {
  participantId: string;
  groupId: string;
  signalType: SignalType;
  note: string; // max 280 chars
}

export interface CareActionResponse {
  careActionId: string;
  recordedAt: string; // ISO 8601
}

// --- Mock Data: Signal Detail (Pedro Almeida - care-urgent) ---

export const mockSignalDetail: SignalDetail = {
  participantId: "019756a1-1001-7000-8000-000000000001",
  name: "Pedro Almeida",
  signalType: "care-urgent",
  groupName: "Jovens Adultos",
  observedFact: {
    variant: "absence",
    text: "Faz 3 semanas que o Pedro não aparece no grupo.",
  },
  systemLimitation: {
    text: "O radar vê presença e ausência — não sabe o motivo. Pode ser viagem, doença ou algo que precisa de conversa.",
  },
  presenceDots: ["present", "present", "absent", "absent", "absent"],
  lastCareRecord: {
    date: "2026-03-20T10:30:00Z",
    type: "message",
  },
};

// --- Mock Data: Signal Detail (Ana Costa - care-urgent, no last care) ---

export const mockSignalDetailNoCare: SignalDetail = {
  participantId: "019756a1-1002-7000-8000-000000000002",
  name: "Ana Costa",
  signalType: "care-urgent",
  groupName: "Jovens Adultos",
  observedFact: {
    variant: "early-exit",
    text: "A Ana saiu cedo nas últimas 2 reuniões.",
  },
  systemLimitation: {
    text: "O radar vê que ela saiu antes do final — não sabe se foi por compromisso, desconforto ou outro motivo.",
  },
  presenceDots: ["present", "present", "present", "present", "absent"],
  lastCareRecord: null,
};

// --- Mock Data: Participant Profile (Pedro Almeida - with memories) ---

export const mockParticipantProfile: ParticipantProfile = {
  participantId: "019756a1-1001-7000-8000-000000000001",
  name: "Pedro Almeida",
  signalType: "care-urgent",
  groupName: "Jovens Adultos",
  presenceDots: ["present", "present", "absent", "absent", "absent"],
  memory: {
    lastConversation: {
      date: "2026-03-20T10:30:00Z",
      note: "Mandei mensagem perguntando se tava tudo bem. Disse que sim mas pareceu evasivo.",
    },
    lastPrayer: {
      date: "2026-03-13T19:30:00Z",
      note: "Orei pelo Pedro no grupo. Ele tava presente nesse dia.",
    },
    nextMilestone: {
      date: "2026-04-17T19:30:00Z",
      dayOfWeek: "quinta",
      eventName: "Próxima reunião",
    },
  },
};

// --- Mock Data: Participant Profile (Ana Costa - empty memories) ---

export const mockParticipantProfileEmpty: ParticipantProfile = {
  participantId: "019756a1-1002-7000-8000-000000000002",
  name: "Ana Costa",
  signalType: "care-urgent",
  groupName: "Jovens Adultos",
  presenceDots: ["present", "present", "present", "present", "absent"],
  memory: {
    lastConversation: null,
    lastPrayer: null,
    nextMilestone: {
      date: "2026-04-17T19:30:00Z",
      dayOfWeek: "quinta",
      eventName: "Próxima reunião",
    },
  },
};

// --- Mock Data: Care Action Response ---

export const mockCareActionResponse: CareActionResponse = {
  careActionId: "019756a1-9001-7000-8000-000000000001",
  recordedAt: "2026-04-13T08:15:00Z",
};
