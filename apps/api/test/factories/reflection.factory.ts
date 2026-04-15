import { generateId } from '@metanoia/types';

interface ReflectionFactoryParams {
  tenantId: string;
  meetingId?: string;
  leaderId?: string;
  text?: string;
  recordedAt?: Date;
}

export function createReflection(params: ReflectionFactoryParams) {
  return {
    id: generateId(),
    tenantId: params.tenantId,
    meetingId: params.meetingId ?? generateId(),
    leaderId: params.leaderId ?? generateId(),
    text: params.text ?? 'Deus falou comigo sobre paciência hoje.',
    recordedAt: params.recordedAt ?? new Date(),
  };
}
