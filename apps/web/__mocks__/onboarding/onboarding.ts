/**
 * Mock fixtures for post-auth onboarding pages (05.4 boas-vindas, 05.5 criar primeiro grupo).
 * Shape derived from the specs under design-process/C-UX-Scenarios/05-*.
 */

export type DemoRadarSignal = "care-urgent" | "care-attention" | "care-ok";

export interface DemoRadarParticipant {
  name: string;
  signalType: DemoRadarSignal;
  contextPhrase: string;
}

export interface DemoRadarResponse {
  /** Illustrative only — tagged so the UI can render a "demo" ribbon. */
  isDemo: true;
  groupName: string;
  participants: DemoRadarParticipant[];
  message: string;
}

export const mockDemoRadar: DemoRadarResponse = {
  isDemo: true,
  groupName: "Grupo Exemplo — Quinta à noite",
  participants: [
    {
      name: "Pedro (exemplo)",
      signalType: "care-urgent",
      contextPhrase: "Faltou nas últimas 3 reuniões",
    },
    {
      name: "Ana (exemplo)",
      signalType: "care-attention",
      contextPhrase: "Saiu cedo na última reunião",
    },
    {
      name: "Marcos (exemplo)",
      signalType: "care-ok",
      contextPhrase: "Participação estável",
    },
  ],
  message:
    "Assim vai ficar quando você tiver seu primeiro grupo com participantes ativos.",
};

// --- POST /api/v1/groups ---

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface CreateGroupRequest {
  name: string;
  description?: string;
  dayOfWeek?: DayOfWeek;
  /** 24h "HH:mm". */
  timeOfDay?: string;
  addSelfAsParticipant: boolean;
}

export interface CreateGroupResponse {
  groupId: string;
  /** True when this was the first group of the tenant — client triggers activation UX. */
  isFirstGroup: boolean;
}

export const mockCreateGroupResponse: CreateGroupResponse = {
  groupId: "019756c0-0001-7000-8000-000000000001",
  isFirstGroup: true,
};
