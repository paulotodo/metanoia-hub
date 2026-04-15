import { generateId } from '@metanoia/types';

interface MeetingFactoryParams {
  tenantId: string;
  groupId?: string;
  scheduledFor?: Date;
  status?: 'scheduled' | 'live' | 'ended';
  topic?: string | null;
  livekitRoomId?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
}

export function createMeeting(params: MeetingFactoryParams) {
  return {
    id: generateId(),
    tenantId: params.tenantId,
    groupId: params.groupId ?? generateId(),
    scheduledFor: params.scheduledFor ?? new Date(),
    status: params.status ?? 'scheduled',
    topic: params.topic ?? null,
    livekitRoomId: params.livekitRoomId ?? null,
    startedAt: params.startedAt ?? null,
    endedAt: params.endedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
