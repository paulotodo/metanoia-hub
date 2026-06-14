/**
 * Integration tests for BrandingService (Story 11-2).
 *
 * Pattern: vi.spyOn to mock dependencies — no real DB/Redis/MinIO needed
 * for unit-level service tests. Follows project pattern from tenants.service.spec.ts.
 *
 * CHK022 — in real integration tests (CI), cleanup would be:
 *   afterEach: flush Redis cache:branding:* + Prisma delete via DATABASE_URL (privileged, bypass RLS).
 *   Here we use mocks to avoid needing a real DB.
 *
 * CHK023 — logo_url in DB is an object key (e.g. "tenants/id/logo-nav.png"),
 *   never a signed URL (no "X-Amz-"). Response logoUrl is a signed URL.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { BrandingService } from '../branding.service';
import { requestContext } from '../../common/context/request-context';

const TENANT_ID = '01912345-6789-7000-8000-000000000042';

/** Signed URL always contains X-Amz- (MinIO presigned) */
const FAKE_SIGNED_URL = `http://minio:9000/bucket/tenants/${TENANT_ID}/logo-nav.png?X-Amz-Signature=abc`;
/** Object key stored in DB (CHK023) */
const LOGO_OBJECT_KEY = `tenants/${TENANT_ID}/logo-nav.png`;

function makeDeps(overrides: {
  plan?: string;
  tenant?: Record<string, unknown>;
  redisGet?: string | null;
} = {}) {
  const plan = overrides.plan ?? 'pro';
  const tenant = overrides.tenant ?? {
    plan,
    logoUrl: null,
    brandPrimaryColor: null,
    brandSecondaryColor: null,
    displayName: null,
  };

  const prismaMock = {
    client: {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          tenant: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(tenant),
            update: vi.fn().mockResolvedValue(tenant),
          },
        };
        return fn(tx);
      }),
    },
  };

  const storageMock = {
    getSignedUrl: vi.fn().mockResolvedValue(FAKE_SIGNED_URL),
    upload: vi.fn().mockResolvedValue(LOGO_OBJECT_KEY),
  };

  const planLimitsMock = {
    getPlan: vi.fn().mockResolvedValue(plan),
  };

  const redisMock = {
    get: vi.fn().mockResolvedValue(overrides.redisGet ?? null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };

  const service = new BrandingService(
    prismaMock as never,
    storageMock as never,
    planLimitsMock as never,
    redisMock as never,
  );

  return { service, prismaMock, storageMock, planLimitsMock, redisMock };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT_ID,
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

// ─── getBranding ──────────────────────────────────────────────────────────────

describe('BrandingService.getBranding', () => {
  it('cold path: DB hit → write-through Redis → returns BrandingResponse', async () => {
    const { service, redisMock } = makeDeps({
      tenant: {
        plan: 'pro',
        logoUrl: LOGO_OBJECT_KEY,
        brandPrimaryColor: '#1E40AF',
        brandSecondaryColor: '#F59E0B',
        displayName: 'Igreja Test',
      },
    });

    const result = await withCtx(() => service.getBranding());

    // Redis was a miss before (null), then SET after DB read
    expect(redisMock.get).toHaveBeenCalledWith(`cache:branding:${TENANT_ID}`);
    expect(redisMock.set).toHaveBeenCalledWith(
      `cache:branding:${TENANT_ID}`,
      expect.any(String),
      'EX',
      3600,
    );

    expect(result.primaryColor).toBe('#1E40AF');
    expect(result.secondaryColor).toBe('#F59E0B');
    expect(result.displayName).toBe('Igreja Test');
    expect(result.plan).toBe('pro');
    expect(result.canCustomizeBranding).toBe(true);
  });

  it('cache hit: returns cached value without DB query', async () => {
    const cachedResponse = {
      primaryColor: '#123456',
      secondaryColor: null,
      displayName: null,
      logoUrl: FAKE_SIGNED_URL,
      plan: 'pro',
      canCustomizeBranding: true,
    };

    const { service, prismaMock, redisMock } = makeDeps({
      redisGet: JSON.stringify(cachedResponse),
    });

    const result = await withCtx(() => service.getBranding());

    // DB must NOT be hit
    expect(prismaMock.client.$transaction).not.toHaveBeenCalled();
    expect(result.primaryColor).toBe('#123456');
    expect(redisMock.get).toHaveBeenCalledOnce();
  });

  it('CHK023: DB logo_url is object key (no X-Amz-); response logoUrl is signed URL', async () => {
    const { service, storageMock } = makeDeps({
      tenant: {
        plan: 'pro',
        logoUrl: LOGO_OBJECT_KEY,
        brandPrimaryColor: null,
        brandSecondaryColor: null,
        displayName: null,
      },
    });

    const result = await withCtx(() => service.getBranding());

    // getSignedUrl called with object key (no signed URL in DB)
    expect(storageMock.getSignedUrl).toHaveBeenCalledWith(LOGO_OBJECT_KEY, 14400);
    // Response has signed URL (contains X-Amz-)
    expect(result.logoUrl).toContain('X-Amz-');
    // Object key without X-Amz- should NOT appear directly
    expect(result.logoUrl).not.toBe(LOGO_OBJECT_KEY);
  });

  it('tenant without logo → logoUrl: null in response', async () => {
    const { service } = makeDeps({
      tenant: { plan: 'free', logoUrl: null, brandPrimaryColor: null, brandSecondaryColor: null, displayName: null },
    });

    const result = await withCtx(() => service.getBranding());
    expect(result.logoUrl).toBeNull();
  });

  it('canCustomizeBranding: true for Pro; false for Free', async () => {
    const { service: proService } = makeDeps({ plan: 'pro', tenant: { plan: 'pro', logoUrl: null, brandPrimaryColor: null, brandSecondaryColor: null, displayName: null } });
    const { service: freeService } = makeDeps({ plan: 'free', tenant: { plan: 'free', logoUrl: null, brandPrimaryColor: null, brandSecondaryColor: null, displayName: null } });

    const proResult = await withCtx(() => proService.getBranding());
    const freeResult = await withCtx(() => freeService.getBranding());

    expect(proResult.canCustomizeBranding).toBe(true);
    expect(freeResult.canCustomizeBranding).toBe(false);
  });
});

// ─── updateBranding ───────────────────────────────────────────────────────────

describe('BrandingService.updateBranding', () => {
  it('Pro tenant: persists colors + displayName; write-through Redis; returns BrandingResponse', async () => {
    const updatedTenant = {
      plan: 'pro',
      logoUrl: null,
      brandPrimaryColor: '#1E40AF',
      brandSecondaryColor: '#F59E0B',
      displayName: 'Igreja X',
    };
    const { service, prismaMock, redisMock } = makeDeps({
      plan: 'pro',
      tenant: updatedTenant,
    });

    const result = await withCtx(() =>
      service.updateBranding({
        primaryColor: '#1E40AF',
        secondaryColor: '#F59E0B',
        displayName: 'Igreja X',
      }),
    );

    expect(prismaMock.client.$transaction).toHaveBeenCalled();
    // Cache is DEL'd then SET via getBranding cold path
    expect(redisMock.del).toHaveBeenCalledWith(`cache:branding:${TENANT_ID}`);
    expect(result.primaryColor).toBe('#1E40AF');
    expect(result.displayName).toBe('Igreja X');
    expect(result.canCustomizeBranding).toBe(true);
  });

  it('Free tenant: colors → ForbiddenException (403); DB not mutated', async () => {
    const { service, prismaMock } = makeDeps({ plan: 'free' });

    await withCtx(async () => {
      await expect(
        service.updateBranding({ primaryColor: '#1E40AF' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // DB must NOT be updated
    expect(prismaMock.client.$transaction).not.toHaveBeenCalled();
  });

  it('Free tenant: only displayName → persists; canCustomizeBranding: false', async () => {
    const freeTenant = {
      plan: 'free',
      logoUrl: null,
      brandPrimaryColor: null,
      brandSecondaryColor: null,
      displayName: 'Igreja Livre',
    };
    const { service } = makeDeps({ plan: 'free', tenant: freeTenant });

    const result = await withCtx(() =>
      service.updateBranding({ displayName: 'Igreja Livre' }),
    );

    expect(result.canCustomizeBranding).toBe(false);
    expect(result.displayName).toBe('Igreja Livre');
  });

  it('body empty {} → no-op; returns current state without error', async () => {
    const { service } = makeDeps({ plan: 'pro' });

    await withCtx(async () => {
      await expect(service.updateBranding({})).resolves.toBeDefined();
    });
  });
});

// ─── uploadLogo ──────────────────────────────────────────────────────────────

/** Minimal valid PNG buffer (1×1 red pixel) */
function makeValidPngBuffer(): Buffer {
  // 1×1 PNG (red pixel) — actual valid PNG bytes
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e000000124944415478016360f8cfc000000000200010000000000000000000' +
    'c08000000049454e44ae426082',
    'hex',
  );
}

function makeFile(overrides: Partial<import('../branding.service').MulterFile> = {}): import('../branding.service').MulterFile {
  return {
    fieldname: 'file',
    originalname: 'logo.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1000,
    buffer: makeValidPngBuffer(),
    ...overrides,
  };
}

describe('BrandingService.uploadLogo', () => {
  it('Pro + valid PNG: uploads nav+fav; DB = object key (no X-Amz-); response = signed URL', async () => {
    const { service, storageMock } = makeDeps({ plan: 'pro' });

    const result = await withCtx(() => service.uploadLogo(makeFile()));

    // upload called for nav and fav
    expect(storageMock.upload).toHaveBeenCalledWith(
      `tenants/${TENANT_ID}/logo-nav.png`,
      expect.any(Buffer),
      'image/png',
    );
    expect(storageMock.upload).toHaveBeenCalledWith(
      `tenants/${TENANT_ID}/logo-fav.png`,
      expect.any(Buffer),
      'image/png',
    );
    // Response has signed URL (X-Amz-)
    expect(result.logoUrl).toContain('X-Amz-');
  });

  it('file > 2MB → UnprocessableEntityException', async () => {
    const { service } = makeDeps({ plan: 'pro' });

    await withCtx(async () => {
      await expect(
        service.uploadLogo(makeFile({ size: 3 * 1024 * 1024 })),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  it('invalid MIME (application/pdf) → UnprocessableEntityException', async () => {
    const { service } = makeDeps({ plan: 'pro' });

    await withCtx(async () => {
      await expect(
        service.uploadLogo(makeFile({ mimetype: 'application/pdf' })),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  it('Free tenant → ForbiddenException', async () => {
    const { service } = makeDeps({ plan: 'free' });

    await withCtx(async () => {
      await expect(service.uploadLogo(makeFile())).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it('file absent (undefined) → BadRequestException', async () => {
    const { service } = makeDeps({ plan: 'pro' });

    await withCtx(async () => {
      await expect(service.uploadLogo(undefined)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

// ─── roundtrip case-convention ────────────────────────────────────────────────

describe('BrandingService — camelCase response contract (CHK025)', () => {
  it('response keys are camelCase (primaryColor not primary_color)', async () => {
    const { service } = makeDeps({
      plan: 'pro',
      tenant: { plan: 'pro', logoUrl: null, brandPrimaryColor: '#1E40AF', brandSecondaryColor: null, displayName: null },
    });

    const result = await withCtx(() => service.getBranding());

    // Assert camelCase keys present
    expect(Object.keys(result)).toContain('primaryColor');
    expect(Object.keys(result)).toContain('secondaryColor');
    expect(Object.keys(result)).toContain('displayName');
    expect(Object.keys(result)).toContain('logoUrl');
    expect(Object.keys(result)).toContain('canCustomizeBranding');

    // Assert snake_case NOT present
    expect(Object.keys(result)).not.toContain('primary_color');
    expect(Object.keys(result)).not.toContain('logo_url');
  });

  it('logoUrl is null (not undefined) when tenant has no logo', async () => {
    const { service } = makeDeps({
      tenant: { plan: 'pro', logoUrl: null, brandPrimaryColor: null, brandSecondaryColor: null, displayName: null },
    });

    const result = await withCtx(() => service.getBranding());
    // null (not undefined) per Constitution II
    expect(result.logoUrl).toBeNull();
    expect(result.logoUrl).not.toBeUndefined();
  });
});
