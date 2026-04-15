import { generateId } from '@metanoia/types';

interface MeetingParticipantFactoryParams {
  tenantId: string;
  meetingId?: string;
  userId?: string | null;
  participantId?: string;
  name?: string;
  response?: 'yes' | 'no' | 'pending';
  joinedAt?: Date | null;
  leftAt?: Date | null;
}

export function createMeetingParticipant(params: MeetingParticipantFactoryParams) {
  return {
    id: generateId(),
    tenantId: params.tenantId,
    meetingId: params.meetingId ?? generateId(),
    userId: params.userId ?? null,
    participantId: params.participantId ?? generateId(),
    name: params.name ?? 'Participante Teste',
    response: params.response ?? 'pending',
    joinedAt: params.joinedAt ?? null,
    leftAt: params.leftAt ?? null,
    createdAt: new Date(),
  };
}
