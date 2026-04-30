import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId } from '@metanoia/types';
import { ConsentService } from '../consent.service';
import { CURRENT_CONSENT_VERSIONS } from '../consent.versions';
import { requestContext } from '../../common/context/request-context';

const USER = '01912345-6789-7000-8000-0000000000a1';
const TENANT = '01912345-6789-7000-8000-000000000001';
const META = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

function createMocks() {
  const repo = {
    findLatestByUser: vi.fn(),
    create: vi.fn(),
  };
  const service = new ConsentService(repo as never);
  return { service, repo };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT,
      userId: USER,
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('ConsentService.getStatus', () => {
  it('reports allUpToDate=false when no consent records exist', async () => {
    const { service, repo } = createMocks();
    repo.findLatestByUser.mockResolvedValue(null);

    const result = await service.getStatus(USER);
    expect(result.data.allUpToDate).toBe(false);
    expect(result.data.documents).toHaveLength(2);
    for (const doc of result.data.documents) {
      expect(doc.acceptedVersion).toBeNull();
      expect(doc.isUpToDate).toBe(false);
    }
  });

  it('reports allUpToDate=true when both documents match current version', async () => {
    const { service, repo } = createMocks();
    repo.findLatestByUser.mockImplementation(
      async (_userId: string, doc: 'terms_of_service' | 'privacy_policy') => ({
        version: CURRENT_CONSENT_VERSIONS[doc],
        acceptedAt: new Date('2026-04-09T10:00:00.000Z'),
      }),
    );

    const result = await service.getStatus(USER);
    expect(result.data.allUpToDate).toBe(true);
  });

  it('reports drift when accepted version is older', async () => {
    const { service, repo } = createMocks();
    repo.findLatestByUser.mockImplementation(async () => ({
      version: '2025-01-01',
      acceptedAt: new Date('2025-01-01T10:00:00.000Z'),
    }));

    const result = await service.getStatus(USER);
    expect(result.data.allUpToDate).toBe(false);
    for (const doc of result.data.documents) {
      expect(doc.acceptedVersion).toBe('2025-01-01');
      expect(doc.isUpToDate).toBe(false);
    }
  });
});

describe('ConsentService.accept', () => {
  let service: ConsentService;
  let repo: ReturnType<typeof createMocks>['repo'];

  beforeEach(() => {
    ({ service, repo } = createMocks());
  });

  it('persists consent record and returns ISO acceptedAt', async () => {
    const id = generateId();
    repo.create.mockResolvedValue({
      id,
      acceptedAt: new Date('2026-04-30T12:00:00.000Z'),
    });

    const result = await withCtx(() =>
      service.accept(
        {
          documentType: 'terms_of_service',
          version: CURRENT_CONSENT_VERSIONS.terms_of_service,
        },
        META,
      ),
    );
    expect(result.data.consentId).toBe(id);
    expect(result.data.documentType).toBe('terms_of_service');
    expect(result.data.version).toBe(CURRENT_CONSENT_VERSIONS.terms_of_service);
    expect(result.data.acceptedAt).toBe('2026-04-30T12:00:00.000Z');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        tenantId: TENANT,
        documentType: 'terms_of_service',
        version: CURRENT_CONSENT_VERSIONS.terms_of_service,
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    );
  });

  it('records the user-supplied version verbatim when it differs from canonical', async () => {
    repo.create.mockResolvedValue({
      id: generateId(),
      acceptedAt: new Date('2026-04-30T12:00:00.000Z'),
    });

    const result = await withCtx(() =>
      service.accept(
        { documentType: 'privacy_policy', version: '2025-12-01-legacy' },
        META,
      ),
    );
    expect(result.data.version).toBe('2025-12-01-legacy');
  });

  it('throws Unauthorized when no userId in context', async () => {
    await expect(
      requestContext.run(
        {
          tenantId: TENANT,
          userId: undefined,
          requestId: generateId(),
          correlationId: generateId(),
        },
        () =>
          service.accept(
            {
              documentType: 'terms_of_service',
              version: CURRENT_CONSENT_VERSIONS.terms_of_service,
            },
            META,
          ),
      ),
    ).rejects.toThrow(/Missing user id/);
  });
});
