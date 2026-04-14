import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId } from '@metanoia/types';
import { GroupsService } from './groups.service';
import { requestContext } from '../common/context/request-context';

function createMocks() {
  const repository = {
    countByTenant: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
  };

  const eventEmitter = {
    emit: vi.fn(),
  };

  const service = new GroupsService(repository as any, eventEmitter as any);

  return { service, repository, eventEmitter };
}

const validBody = {
  name: 'Célula da Paz',
  dayOfWeek: 'wed',
  time: '19:30',
  recurrence: 'weekly',
  notes: null,
} as const;

function buildGroupRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: generateId(),
    tenantId: '01912345-6789-7000-8000-000000000001',
    name: validBody.name,
    dayOfWeek: validBody.dayOfWeek,
    time: validBody.time,
    recurrence: validBody.recurrence,
    notes: validBody.notes,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('GroupsService', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it('emits tenant.activation.primary when creating the first group', async () => {
    const tenantId = '01912345-6789-7000-8000-000000000001';
    const userId = '01912345-6789-7000-8000-000000000abc';

    mocks.repository.countByTenant.mockResolvedValue(0);
    mocks.repository.create.mockResolvedValue(buildGroupRow({ tenantId }));

    await requestContext.run(
      { tenantId, userId, requestId: generateId(), correlationId: generateId() },
      async () => {
        await mocks.service.create(validBody as any);
      },
    );

    expect(mocks.eventEmitter.emit).toHaveBeenCalledOnce();
    expect(mocks.eventEmitter.emit).toHaveBeenCalledWith(
      'tenant.activation.primary',
      expect.objectContaining({ tenantId, userId }),
    );
  });

  it('does not emit tenant.activation.primary when groups already exist', async () => {
    const tenantId = '01912345-6789-7000-8000-000000000001';

    mocks.repository.countByTenant.mockResolvedValue(3);
    mocks.repository.create.mockResolvedValue(buildGroupRow({ tenantId }));

    await requestContext.run(
      {
        tenantId,
        userId: generateId(),
        requestId: generateId(),
        correlationId: generateId(),
      },
      async () => {
        await mocks.service.create(validBody as any);
      },
    );

    expect(mocks.eventEmitter.emit).not.toHaveBeenCalled();
  });
});
