import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { ReflectionsService } from './reflections.service';
import { requestContext } from '../common/context/request-context';

function createMocks() {
  const meetings = {
    findById: vi.fn(),
  };
  const reflections = {
    create: vi.fn(),
  };
  const eventEmitter = {
    emit: vi.fn(),
  };
  const service = new ReflectionsService(
    meetings as any,
    reflections as any,
    eventEmitter as any,
  );
  return { service, meetings, reflections, eventEmitter };
}

const TENANT = '01912345-6789-7000-8000-000000000001';
const USER = '01912345-6789-7000-8000-0000000000aa';
const MEETING = '01912345-6789-7000-8000-000000000100';

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    { tenantId: TENANT, userId: USER, requestId: generateId(), correlationId: generateId() },
    fn,
  );
}

describe('ReflectionsService', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it('persists reflection and emits reflections.captured', async () => {
    mocks.meetings.findById.mockResolvedValue({ id: MEETING, tenantId: TENANT });
    const recordedAt = new Date('2026-04-20T22:15:00.000Z');
    const reflectionId = generateId();
    mocks.reflections.create.mockResolvedValue({
      id: reflectionId,
      tenantId: TENANT,
      meetingId: MEETING,
      leaderId: USER,
      text: 'Deus falou comigo sobre paciência.',
      recordedAt,
    });

    const result = await withCtx(() =>
      mocks.service.create(MEETING, { text: 'Deus falou comigo sobre paciência.' }),
    );

    expect(mocks.reflections.create).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: MEETING,
        leaderId: USER,
        text: 'Deus falou comigo sobre paciência.',
      }),
    );
    expect(mocks.eventEmitter.emit).toHaveBeenCalledWith(
      'reflections.captured',
      expect.objectContaining({ tenantId: TENANT, meetingId: MEETING, reflectionId }),
    );
    expect(result.reflectionId).toBe(reflectionId);
    expect(result.recordedAt).toBe(recordedAt.toISOString());
  });

  it('throws NotFoundException when meeting does not exist', async () => {
    mocks.meetings.findById.mockResolvedValue(null);

    await expect(
      withCtx(() => mocks.service.create(MEETING, { text: 'oi' })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.reflections.create).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when userId missing from context', async () => {
    mocks.meetings.findById.mockResolvedValue({ id: MEETING, tenantId: TENANT });

    await expect(
      requestContext.run(
        { tenantId: TENANT, requestId: generateId(), correlationId: generateId() },
        () => mocks.service.create(MEETING, { text: 'oi' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
