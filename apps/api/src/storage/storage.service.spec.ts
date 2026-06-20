import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { requestContext } from '../common/context/request-context';

// Mock Minio client — use a real class so `new Minio.Client()` constructs
// correctly under vitest SSR namespace-import interop.
const putObjectMock = vi.fn().mockResolvedValue(undefined);
vi.mock('minio', () => ({
  Client: class {
    bucketExists = vi.fn().mockResolvedValue(true);
    makeBucket = vi.fn().mockResolvedValue(undefined);
    putObject = putObjectMock;
    presignedGetObject = vi.fn().mockResolvedValue('https://signed.url');
  },
}));

const makeMockPrisma = () => {
  const $executeRaw = vi.fn().mockResolvedValue(1);
  return { client: { $executeRaw }, $executeRaw };
};

const makeMockConfig = () => ({
  get: vi.fn((key: string, fallback?: unknown) => {
    const map: Record<string, unknown> = {
      MINIO_ENDPOINT: 'http://localhost:9000',
      MINIO_ACCESS_KEY: 'test',
      MINIO_SECRET_KEY: 'test',
      MINIO_BUCKET: 'test-bucket',
    };
    return map[key] ?? fallback;
  }),
});

describe('StorageService.upload (SEC-03 hook)', () => {
  let service: StorageService;
  let prisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    prisma = makeMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: makeMockConfig() },
      ],
    }).compile();
    service = module.get(StorageService);
  });

  it('returns the objectKey after upload', async () => {
    const key = await requestContext.run(
      { tenantId: 'aaa', requestId: 'r1', correlationId: 'c1' },
      () => service.upload('test/file.pdf', Buffer.from('hello'), 'application/pdf'),
    );
    expect(key).toBe('test/file.pdf');
  });

  it('calls $executeRaw for UPSERT when tenant context is present', async () => {
    await requestContext.run(
      { tenantId: '018e5b3c-0000-7000-8000-000000000001', requestId: 'r1', correlationId: 'c1' },
      () => service.upload('file.pdf', Buffer.from('x'), 'application/pdf'),
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('skips UPSERT and logs warn when no tenant context', async () => {
    // No requestContext.run wrapper → getStore() returns undefined
    const loggerWarnSpy = vi.spyOn(service['logger'], 'warn');
    await service.upload('file.pdf', Buffer.from('x'), 'application/pdf');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'storage-hook: skipping upsert, no tenant context',
    );
  });

  it('continues upload even when UPSERT fails (non-fatal)', async () => {
    prisma.$executeRaw.mockRejectedValueOnce(new Error('DB error'));
    const loggerErrorSpy = vi.spyOn(service['logger'], 'error');
    const key = await requestContext.run(
      { tenantId: 'aaa', requestId: 'r1', correlationId: 'c1' },
      () => service.upload('file.pdf', Buffer.from('x'), 'application/pdf'),
    );
    expect(key).toBe('file.pdf');
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
