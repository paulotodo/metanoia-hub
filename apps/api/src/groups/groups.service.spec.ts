import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId } from '@metanoia/types';
import { GroupsService } from './groups.service';
import { requestContext } from '../common/context/request-context';

function createMocks() {
  const repository = {
    countByTenant: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    listByTenant: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

  it('list returns all groups for tenant with total meta', async () => {
    mocks.repository.listByTenant.mockResolvedValue([
      buildGroupRow(),
      buildGroupRow({ id: generateId(), name: 'Outro Grupo' }),
    ]);
    const result = await mocks.service.list();
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
  });

  it('findById returns group when found', async () => {
    const id = generateId();
    mocks.repository.findById.mockResolvedValue(buildGroupRow({ id }));
    const result = await mocks.service.findById(id);
    expect(result.id).toBe(id);
  });

  it('findById throws NotFoundException when not found', async () => {
    mocks.repository.findById.mockResolvedValue(null);
    await expect(
      mocks.service.findById('019800a0-0000-7000-8000-000000000099'),
    ).rejects.toThrow(/Group not found/);
  });

  it('update applies partial patch and returns updated group', async () => {
    const id = generateId();
    mocks.repository.update.mockResolvedValue(
      buildGroupRow({ id, name: 'Novo Nome' }),
    );
    const result = await mocks.service.update(id, { name: 'Novo Nome' });
    expect(result.name).toBe('Novo Nome');
    expect(mocks.repository.update).toHaveBeenCalledWith(id, {
      name: 'Novo Nome',
    });
  });

  it('update preserves existing fields when only some are provided', async () => {
    const id = generateId();
    mocks.repository.update.mockResolvedValue(
      buildGroupRow({ id, dayOfWeek: 'thu', time: '20:00' }),
    );
    await mocks.service.update(id, { dayOfWeek: 'thu', time: '20:00' });
    expect(mocks.repository.update).toHaveBeenCalledWith(id, {
      dayOfWeek: 'thu',
      time: '20:00',
    });
    // name/recurrence/notes not in patch
    const call = mocks.repository.update.mock.calls[0][1];
    expect(call).not.toHaveProperty('name');
    expect(call).not.toHaveProperty('recurrence');
  });

  it('update throws 404 when group missing', async () => {
    mocks.repository.update.mockResolvedValue(null);
    await expect(
      mocks.service.update('019800a0-0000-7000-8000-000000000099', {
        name: 'X',
      }),
    ).rejects.toThrow(/Group not found/);
  });

  it('delete returns void when successful', async () => {
    mocks.repository.delete.mockResolvedValue(buildGroupRow());
    await expect(
      mocks.service.delete('019800a0-0000-7000-8000-000000000001'),
    ).resolves.toBeUndefined();
  });

  it('delete throws 404 when group missing', async () => {
    mocks.repository.delete.mockResolvedValue(null);
    await expect(
      mocks.service.delete('019800a0-0000-7000-8000-000000000099'),
    ).rejects.toThrow(/Group not found/);
  });
});
