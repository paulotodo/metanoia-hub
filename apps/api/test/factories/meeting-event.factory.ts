import { generateId } from '@metanoia/types';

interface MeetingEventFactoryParams {
  tenantId: string;
  meetingId?: string;
  userId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  version?: number;
}

export function createMeetingEvent(params: MeetingEventFactoryParams) {
  return {
    id: generateId(),
    tenantId: params.tenantId,
    meetingId: params.meetingId ?? generateId(),
    userId: params.userId ?? generateId(),
    eventType: params.eventType ?? 'meetings.participant.joined',
    payload: params.payload ?? {},
    version: params.version ?? 1,
    createdAt: new Date(),
  };
}
