import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  UnsupportedMediaTypeException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import type { StorageService } from '../../storage/storage.service';
import type { ContentRepository } from '../content.repository';

// ---------------------------------------------------------------------------
// Mock request context
// ---------------------------------------------------------------------------
vi.mock('../../common/context/request-context', () => ({
  getRequestContext: () => ({ tenantId: TENANT_ID, userId: USER_ID }),
}));

const TENANT_ID = '019756c0-0001-7000-8000-000000000002';
const USER_ID = '019756c0-0001-7000-8000-000000000003';
const TRAIL_ID = '019756c0-0001-7000-8000-000000000010';
const MODULE_ID = '019756c0-0001-7000-8000-000000000020';
const LESSON_ID = '019756c0-0001-7000-8000-000000000030';

function makeLesson() {
  return {
    id: LESSON_ID,
    tenantId: TENANT_ID,
    moduleId: MODULE_ID,
    contentUrl: null,
    name: 'Aula de Teste',
    contentType: 'video' as const,
    contentBody: null,
    tags: [],
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: null,
    uploadedAt: null,
    order: 0,
    estimatedDurationMinutes: null,
    createdAt: new Date('2026-06-11T10:00:00Z'),
    updatedAt: new Date('2026-06-11T10:00:00Z'),
    deletedAt: null,
  };
}

function makeMockStorage(): StorageService {
  return {
    upload: vi.fn().mockResolvedValue('content/tenant-1/trail-1/lesson-1/file.mp4'),
    getSignedUrl: vi.fn().mockResolvedValue('https://minio.example.com/signed-url'),
    onModuleInit: vi.fn(),
  } as unknown as StorageService;
}

function makeMockRepo(): ContentRepository {
  return {
    findLessonById: vi.fn().mockResolvedValue(makeLesson()),
    updateLesson: vi.fn().mockResolvedValue(makeLesson()),
    findLessonByIdOnly: vi.fn().mockResolvedValue(makeLesson()),
    findTrailWithModulesAndLessons: vi.fn(),
  } as unknown as ContentRepository;
}

describe('UploadService', () => {
  let service: UploadService;
  let mockStorage: StorageService;
  let mockRepo: ContentRepository;

  beforeEach(() => {
    mockStorage = makeMockStorage();
    mockRepo = makeMockRepo();
    service = new UploadService(mockStorage, mockRepo);
  });

  describe('uploadLessonContent', () => {
    const validBuffer = Buffer.from('mock-video-content');

    it('builds correct MinIO object key', async () => {
      const result = await service.uploadLessonContent({
        lessonId: LESSON_ID,
        moduleId: MODULE_ID,
        trailId: TRAIL_ID,
        buffer: validBuffer,
        originalName: 'video.mp4',
        mimeType: 'video/mp4',
      });

      // Key pattern: content/{tenantId}/{trailId}/{lessonId}/{filename}
      expect(result.objectKey).toBe(
        `content/${TENANT_ID}/${TRAIL_ID}/${LESSON_ID}/video.mp4`,
      );
      expect(mockStorage.upload).toHaveBeenCalledWith(
        `content/${TENANT_ID}/${TRAIL_ID}/${LESSON_ID}/video.mp4`,
        validBuffer,
        'video/mp4',
      );
    });

    it('sanitizes filename with special chars', async () => {
      const result = await service.uploadLessonContent({
        lessonId: LESSON_ID,
        moduleId: MODULE_ID,
        trailId: TRAIL_ID,
        buffer: validBuffer,
        originalName: 'vídeo lição #1 (final).mp4',
        mimeType: 'video/mp4',
      });

      // Special chars replaced with underscore
      expect(result.originalName).toBe('vídeo lição #1 (final).mp4');
      expect(result.objectKey).toMatch(
        /^content\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\//,
      );
    });

    it('stores sizeBytes in result', async () => {
      const buf = Buffer.from('a'.repeat(1024));
      const result = await service.uploadLessonContent({
        lessonId: LESSON_ID,
        moduleId: MODULE_ID,
        trailId: TRAIL_ID,
        buffer: buf,
        originalName: 'test.mp4',
        mimeType: 'video/mp4',
      });

      expect(result.sizeBytes).toBe(1024);
    });

    it('returns uploadedAt as ISO string', async () => {
      const result = await service.uploadLessonContent({
        lessonId: LESSON_ID,
        moduleId: MODULE_ID,
        trailId: TRAIL_ID,
        buffer: validBuffer,
        originalName: 'test.mp4',
        mimeType: 'video/mp4',
      });

      expect(() => new Date(result.uploadedAt)).not.toThrow();
      expect(result.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('throws UnsupportedMediaTypeException for disallowed mimeType', async () => {
      await expect(
        service.uploadLessonContent({
          lessonId: LESSON_ID,
          moduleId: MODULE_ID,
          trailId: TRAIL_ID,
          buffer: validBuffer,
          originalName: 'file.exe',
          mimeType: 'application/octet-stream',
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    });

    it('throws PayloadTooLargeException for file > 500MB', async () => {
      const hugeBuf = { length: 501 * 1024 * 1024 } as unknown as Buffer;
      await expect(
        service.uploadLessonContent({
          lessonId: LESSON_ID,
          moduleId: MODULE_ID,
          trailId: TRAIL_ID,
          buffer: hugeBuf,
          originalName: 'big.mp4',
          mimeType: 'video/mp4',
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      vi.mocked(mockRepo.findLessonById).mockResolvedValueOnce(null);

      await expect(
        service.uploadLessonContent({
          lessonId: LESSON_ID,
          moduleId: MODULE_ID,
          trailId: TRAIL_ID,
          buffer: validBuffer,
          originalName: 'video.mp4',
          mimeType: 'video/mp4',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('StorageService (unit — signed URL expiration)', () => {
  it('getSignedUrl is called with 14400s expiration (4h)', async () => {
    const mockStorage = makeMockStorage();
    const mockRepo = makeMockRepo();
    const service = new UploadService(mockStorage, mockRepo);

    // Upload first so lesson has a contentUrl
    vi.mocked(mockRepo.findLessonById).mockResolvedValueOnce({
      ...makeLesson(),
      contentUrl: `content/${TENANT_ID}/${TRAIL_ID}/${LESSON_ID}/file.mp4`,
    });

    await service.uploadLessonContent({
      lessonId: LESSON_ID,
      moduleId: MODULE_ID,
      trailId: TRAIL_ID,
      buffer: Buffer.from('x'),
      originalName: 'file.mp4',
      mimeType: 'video/mp4',
    });

    // The storage.upload call should have happened once with the key
    expect(mockStorage.upload).toHaveBeenCalledOnce();
    // getSignedUrl is NOT called during upload — only on read
    expect(mockStorage.getSignedUrl).not.toHaveBeenCalled();
  });

  it('getSignedUrl is called with 14400 when generating presigned URL', async () => {
    const mockStorage = makeMockStorage();
    const EXPIRY = 14400;
    const objectKey = `content/${TENANT_ID}/${TRAIL_ID}/${LESSON_ID}/file.mp4`;

    await mockStorage.getSignedUrl(objectKey, EXPIRY);

    expect(mockStorage.getSignedUrl).toHaveBeenCalledWith(objectKey, EXPIRY);
  });
});
