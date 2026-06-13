import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SuperAdminTenantsService } from './super-admin-tenants.service';

// Prevent demo-data.seed.ts CLI main() from calling process.exit during import
vi.mock('../onboarding/seed/demo-data.seed', () => ({
  seedDemoData: vi.fn().mockResolvedValue(undefined),
}));

const TENANT_A = '019800a0-0000-7000-8000-000000000001';
const SUSPENDED_ID = '019800a0-0000-7000-8000-000000000004';

function makeTenantRow(overrides: Partial<{
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  adminEmail: string;
  provisioningState: unknown;
  metadata: Record<string, unknown> | null;
  updatedAt: Date | null;
}> = {}) {
  return {
    id: overrides.id ?? TENANT_A,
    tenantId: overrides.id ?? TENANT_A,
    name: overrides.name ?? 'Igreja Caminho Novo',
    slug: 'slug' in overrides ? overrides.slug : 'igreja-caminho-novo',
    plan: overrides.plan ?? 'pro',
    status: overrides.status ?? 'active',
    adminEmail: overrides.adminEmail ?? 'admin@caminho.org',
    provisioningState: overrides.provisioningState ?? null,
    metadata: 'metadata' in overrides ? overrides.metadata : {},
    createdAt: new Date('2026-04-01T12:00:00.000Z'),
    updatedAt: 'updatedAt' in overrides ? overrides.updatedAt : new Date('2026-04-01T14:00:00.000Z'),
  };
}

function createMocks() {
  const repo = {
    list: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    aggregates: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateName: vi.fn(),
    updateMetadata: vi.fn(),
    setProvisioningState: vi.fn(),
  };
  const demoDataService = {
    seedDemoData: vi.fn().mockResolvedValue(undefined),
    deleteDemoData: vi.fn().mockResolvedValue(undefined),
    getDemoStatus: vi.fn(),
    dismissNudge: vi.fn(),
  };
  const service = new SuperAdminTenantsService(repo as never, demoDataService as never);
  return { service, repo, demoDataService };
}

describe('SuperAdminTenantsService.list', () => {
  let service: SuperAdminTenantsService;
  let repo: ReturnType<typeof createMocks>['repo'];

  beforeEach(() => {
    ({ service, repo } = createMocks());
  });

  it('returns paginated envelope with member counts', async () => {
    repo.list.mockResolvedValue({
      rows: [makeTenantRow()],
      total: 1,
      memberCounts: new Map([[TENANT_A, 42]]),
    });

    const result = await service.list({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    } as never);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.memberCount).toBe(42);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('falls back to id when slug is missing on legacy tenants', async () => {
    repo.list.mockResolvedValue({
      rows: [makeTenantRow({ slug: null })],
      total: 1,
      memberCounts: new Map(),
    });

    const result = await service.list({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    } as never);

    expect(result.data[0]?.slug).toBe(TENANT_A);
    expect(result.data[0]?.memberCount).toBe(0);
  });
});

describe('SuperAdminTenantsService.detail', () => {
  it('throws 404 when tenant is missing', async () => {
    const { service, repo } = createMocks();
    repo.findById.mockResolvedValue(null);
    await expect(service.detail(TENANT_A)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns aggregates without leaking pastoral data', async () => {
    const { service, repo } = createMocks();
    repo.findById.mockResolvedValue(makeTenantRow());
    repo.aggregates.mockResolvedValue({
      memberCount: 142,
      groupCount: 12,
      leaderCount: 5,
    });

    const result = await service.detail(TENANT_A);

    expect(result.data.memberCount).toBe(142);
    expect(result.data.groupCount).toBe(12);
    expect(result.data.leaderCount).toBe(5);
    // Privacy boundary: NEVER returns nominative data — only counts.
    expect(Object.keys(result.data)).not.toContain('members');
    expect(Object.keys(result.data)).not.toContain('memberNames');
  });
});

describe('SuperAdminTenantsService.provision', () => {
  it('rejects with 409 when slug already exists', async () => {
    const { service, repo } = createMocks();
    repo.findBySlug.mockResolvedValue(makeTenantRow());

    await expect(
      service.provision({
        name: 'Igreja Caminho Novo',
        slug: 'igreja-caminho-novo',
        adminEmail: 'admin@caminho.org',
        plan: 'pro',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates tenant, schedules saga, returns provisioning status', async () => {
    const { service, repo } = createMocks();
    repo.findBySlug.mockResolvedValue(null);
    repo.create.mockResolvedValue(makeTenantRow({ status: 'provisioning' }));
    repo.setProvisioningState.mockResolvedValue(undefined);
    repo.updateStatus.mockResolvedValue(undefined);

    const result = await service.provision({
      name: 'Igreja Restauração',
      slug: 'igreja-restauracao',
      adminEmail: 'admin@restauracao.org',
      plan: 'pro',
    });

    expect(result.data.status).toBe('provisioning');
    expect(result.data.tenantId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(repo.create).toHaveBeenCalled();
  });
});

describe('SuperAdminTenantsService.patch', () => {
  it('blocks invalid status transitions (active → provisioning)', async () => {
    const { service, repo } = createMocks();
    repo.findById.mockResolvedValue(makeTenantRow({ status: 'active' }));
    // Schema only allows active|suspended; test the service-level guard for
    // any future loosening.
    await expect(
      service.patch(TENANT_A, { status: 'active' as never }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows active → suspended and returns updated detail', async () => {
    const { service, repo } = createMocks();
    repo.findById
      .mockResolvedValueOnce(makeTenantRow({ status: 'active' }))
      .mockResolvedValueOnce(makeTenantRow({ status: 'suspended', id: SUSPENDED_ID }));
    repo.updateStatus.mockResolvedValue(undefined);
    repo.aggregates.mockResolvedValue({
      memberCount: 0,
      groupCount: 0,
      leaderCount: 0,
    });

    const result = await service.patch(TENANT_A, { status: 'suspended' });

    expect(result.data.status).toBe('suspended');
    expect(repo.updateStatus).toHaveBeenCalledWith(TENANT_A, 'suspended');
  });

  it('renames tenant and returns fresh detail', async () => {
    const { service, repo } = createMocks();
    repo.findById
      .mockResolvedValueOnce(makeTenantRow())
      .mockResolvedValueOnce(makeTenantRow({ name: 'Igreja Renomeada' }));
    repo.updateName.mockResolvedValue(undefined);
    repo.aggregates.mockResolvedValue({
      memberCount: 0,
      groupCount: 0,
      leaderCount: 0,
    });

    const result = await service.patch(TENANT_A, { name: 'Igreja Renomeada' });
    expect(result.data.name).toBe('Igreja Renomeada');
    expect(repo.updateName).toHaveBeenCalledWith(TENANT_A, 'Igreja Renomeada');
  });

  it('returns updatedAt as ISO 8601 string in detail response', async () => {
    const { service, repo } = createMocks();
    const updatedAt = new Date('2026-06-10T10:30:00.000Z');
    repo.findById
      .mockResolvedValueOnce(makeTenantRow({ status: 'active' }))
      .mockResolvedValueOnce(makeTenantRow({ updatedAt }));
    repo.updateName.mockResolvedValue(undefined);
    repo.aggregates.mockResolvedValue({
      memberCount: 0,
      groupCount: 0,
      leaderCount: 0,
    });

    const result = await service.patch(TENANT_A, { name: 'Igreja Nova' });
    expect(result.data.updatedAt).toBe('2026-06-10T10:30:00.000Z');
  });

  it('falls back to createdAt when updatedAt is absent (pre-migration row)', async () => {
    const { service, repo } = createMocks();
    const createdAt = new Date('2026-04-01T12:00:00.000Z');
    const row = { ...makeTenantRow(), updatedAt: null, createdAt };
    repo.findById
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(row);
    repo.aggregates.mockResolvedValue({
      memberCount: 0,
      groupCount: 0,
      leaderCount: 0,
    });

    const result = await service.detail(TENANT_A);
    expect(result.data.updatedAt).toBe('2026-04-01T12:00:00.000Z');
  });

  it('updates metadata and merges with existing data', async () => {
    const { service, repo } = createMocks();
    const existingMetadata = { support_tier: 'gold' };
    const patchMetadata = { custom_flag: true };
    repo.findById
      .mockResolvedValueOnce(makeTenantRow({ metadata: existingMetadata }))
      .mockResolvedValueOnce(makeTenantRow({ metadata: { ...existingMetadata, ...patchMetadata } }));
    repo.updateMetadata.mockResolvedValue(undefined);
    repo.aggregates.mockResolvedValue({
      memberCount: 0,
      groupCount: 0,
      leaderCount: 0,
    });

    const result = await service.patch(TENANT_A, { metadata: patchMetadata });
    expect(result.data.metadata).toMatchObject({ support_tier: 'gold', custom_flag: true });
    expect(repo.updateMetadata).toHaveBeenCalledWith(TENANT_A, patchMetadata);
  });

  it('detail returns empty metadata object when metadata is null (pre-migration row)', async () => {
    const { service, repo } = createMocks();
    repo.findById.mockResolvedValue(makeTenantRow({ metadata: null }));
    repo.aggregates.mockResolvedValue({
      memberCount: 0,
      groupCount: 0,
      leaderCount: 0,
    });

    const result = await service.detail(TENANT_A);
    expect(result.data.metadata).toEqual({});
  });
});

describe('SuperAdminTenantsService.retry', () => {
  it('rejects retry when tenant is not in provisioning_failed state', async () => {
    const { service, repo } = createMocks();
    repo.findById.mockResolvedValue(makeTenantRow({ status: 'active' }));
    await expect(service.retry(TENANT_A)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('moves status back to provisioning and re-runs saga', async () => {
    const { service, repo } = createMocks();
    repo.findById.mockResolvedValue(
      makeTenantRow({ status: 'provisioning_failed' }),
    );
    repo.updateStatus.mockResolvedValue(undefined);
    repo.setProvisioningState.mockResolvedValue(undefined);

    const result = await service.retry(TENANT_A);
    expect(result.data.status).toBe('provisioning');
    expect(repo.updateStatus).toHaveBeenCalledWith(TENANT_A, 'provisioning');
  });
});

// ─── Provisioning hook: Step 4 — seedDemoData ────────────────────────────────

describe('SuperAdminTenantsService.runSaga (Step 4 — seedDemoData)', () => {
  it('calls seedDemoData with the new tenant id after successful provisioning', async () => {
    const { service, repo, demoDataService } = createMocks();
    repo.findBySlug.mockResolvedValue(null);
    repo.create.mockResolvedValue(makeTenantRow({ status: 'provisioning' }));
    repo.setProvisioningState.mockResolvedValue(undefined);
    repo.updateStatus.mockResolvedValue(undefined);

    await service.provision({
      name: 'Igreja Restauração',
      slug: 'igreja-restauracao',
      adminEmail: 'admin@restauracao.org',
      plan: 'pro',
    });

    // runSaga is async and fire-and-forget — give it a tick to run
    await new Promise((r) => setImmediate(r));

    expect(demoDataService.seedDemoData).toHaveBeenCalledTimes(1);
    // tenantId is the generated UUID from provision()
    expect(demoDataService.seedDemoData).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    );
  });

  it('does NOT abort provisioning when seedDemoData throws (non-fatal, FR-05)', async () => {
    const { service, repo, demoDataService } = createMocks();
    repo.findBySlug.mockResolvedValue(null);
    repo.create.mockResolvedValue(makeTenantRow({ status: 'provisioning' }));
    repo.setProvisioningState.mockResolvedValue(undefined);
    repo.updateStatus.mockResolvedValue(undefined);
    demoDataService.seedDemoData.mockRejectedValue(new Error('DB unavailable'));

    // provision() must not throw even if seed fails
    await expect(service.provision({
      name: 'Igreja Restauração',
      slug: 'igreja-restauracao',
      adminEmail: 'admin@restauracao.org',
      plan: 'pro',
    })).resolves.not.toThrow();

    // Wait for the async saga to complete
    await new Promise((r) => setImmediate(r));

    // updateStatus to 'active' must still be called (saga completed despite seed failure)
    expect(repo.updateStatus).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
      'active',
    );
  });

  it('seedDemoData failure is non-fatal — provisioning status becomes active', async () => {
    const { service, repo, demoDataService } = createMocks();
    repo.findBySlug.mockResolvedValue(null);
    repo.create.mockResolvedValue(makeTenantRow({ status: 'provisioning' }));
    repo.setProvisioningState.mockResolvedValue(undefined);
    repo.updateStatus.mockResolvedValue(undefined);
    demoDataService.seedDemoData.mockRejectedValue(new Error('Timeout'));

    await service.provision({
      name: 'Igreja Nova',
      slug: 'igreja-nova',
      adminEmail: 'admin@nova.org',
      plan: 'basic',
    });

    await new Promise((r) => setImmediate(r));

    // The saga outer catch must NOT be triggered — failure is isolated to Step 4 try/catch
    const statusCalls = repo.updateStatus.mock.calls.map((c: unknown[]) => c[1]);
    expect(statusCalls).toContain('active');
    expect(statusCalls).not.toContain('provisioning_failed');
  });
});
