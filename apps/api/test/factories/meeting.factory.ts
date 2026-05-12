import { generateId } from '@metanoia/types';

interface MeetingFactoryParams {
  tenantId: string;
  groupId?: string;
  title?: string | null;
  scheduledFor?: Date;
  durationMinutes?: number | null;
  status?: 'scheduled' | 'live' | 'ended' | 'cancelled';
  topic?: string | null;
  livekitRoomId?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  cancelledAt?: Date | null;
  createdBy?: string | null;
}

export function createMeeting(params: MeetingFactoryParams) {
  return {
    id: generateId(),
    tenantId: params.tenantId,
    groupId: params.groupId ?? generateId(),
    title: params.title ?? null,
    scheduledFor: params.scheduledFor ?? new Date(),
    durationMinutes: params.durationMinutes ?? null,
    status: params.status ?? 'scheduled',
    topic: params.topic ?? null,
    livekitRoomId: params.livekitRoomId ?? null,
    startedAt: params.startedAt ?? null,
    endedAt: params.endedAt ?? null,
    cancelledAt: params.cancelledAt ?? null,
    createdBy: params.createdBy ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
