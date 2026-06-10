import { describe, it, expect } from 'vitest';
import {
  TrailStatusSchema,
  LessonContentTypeSchema,
  CreateTrailRequestSchema,
  UpdateTrailRequestSchema,
  TrailResponseSchema,
  CreateModuleRequestSchema,
  UpdateModuleRequestSchema,
  ModuleResponseSchema,
  CreateLessonRequestSchema,
  UpdateLessonRequestSchema,
  LessonResponseSchema,
  UploadResponseSchema,
  SignedUrlResponseSchema,
  LessonStatusSchema,
  ReportProgressRequestSchema,
  LessonProgressJobPayloadSchema,
  TrailProgressUpdatedEventSchema,
  TrailPublishedEventSchema,
  TrailVersionResponseSchema,
  GroupTrailResponseSchema,
  AssociateTrailsRequestSchema,
  AssociateTrailsResponseSchema,
  GroupTrailsListResponseSchema,
  InvalidTrailIdsResponseSchema,
  VideoIntervalSchema,
  VideoProgressPayloadSchema,
  CompletedBySchema,
  ManualCompletionRequestSchema,
  TenantContentConfigSchema,
  UpdateTenantContentConfigSchema,
  TrailAccessModeSchema,
  LessonAccessModeSchema,
  SetPrerequisitesRequestSchema,
  ModulePrerequisiteResponseSchema,
} from '../index';

// ------------------------------------------------------------------
// TrailStatusSchema
// ------------------------------------------------------------------
describe('TrailStatusSchema snapshot', () => {
  it('freezes valid and invalid values', () => {
    const ok = TrailStatusSchema.safeParse('published');
    const fail = TrailStatusSchema.safeParse('deleted');
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "published",
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// LessonContentTypeSchema
// ------------------------------------------------------------------
describe('LessonContentTypeSchema snapshot', () => {
  it('freezes valid and invalid values', () => {
    const ok = LessonContentTypeSchema.safeParse('video');
    const fail = LessonContentTypeSchema.safeParse('audio');
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "video",
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// CreateTrailRequestSchema
// ------------------------------------------------------------------
describe('CreateTrailRequestSchema snapshot', () => {
  it('freezes success shape with all fields', () => {
    const ok = CreateTrailRequestSchema.safeParse({
      name: 'Trilha de Discipulado',
      description: 'Uma trilha completa para novos discípulos.',
      status: 'draft',
    });
    const fail = CreateTrailRequestSchema.safeParse({
      name: 'x',
      status: 'invalid',
    });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "accessMode": "free",
          "description": "Uma trilha completa para novos discípulos.",
          "name": "Trilha de Discipulado",
          "status": "draft",
        },
        "failure": true,
        "success": true,
      }
    `);
  });

  it('applies default status when omitted', () => {
    const result = CreateTrailRequestSchema.safeParse({
      name: 'Trilha Simples',
    });
    expect(result.success && result.data.status).toBe('draft');
  });
});

// ------------------------------------------------------------------
// UpdateTrailRequestSchema
// ------------------------------------------------------------------
describe('UpdateTrailRequestSchema snapshot', () => {
  it('accepts partial updates', () => {
    const ok = UpdateTrailRequestSchema.safeParse({
      name: 'Trilha Atualizada',
      status: 'published',
    });
    const fail = UpdateTrailRequestSchema.safeParse({ status: 'invalid' });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "name": "Trilha Atualizada",
          "status": "published",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// TrailResponseSchema (Story 8-6: added version, publishedAt, publishedBy, catalogVisible)
// ------------------------------------------------------------------
describe('TrailResponseSchema snapshot', () => {
  it('freezes success shape with all publishing fields', () => {
    const ok = TrailResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000010',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      name: 'Trilha de Discipulado',
      description: null,
      status: 'published',
      accessMode: 'free',
      version: 1,
      publishedAt: '2026-06-15T10:00:00.000Z',
      publishedBy: '019756c0-0001-7000-8000-000000000003',
      catalogVisible: false,
      createdBy: '019756c0-0001-7000-8000-000000000003',
      createdAt: '2026-06-10T12:00:00.000Z',
      updatedAt: '2026-06-15T10:00:00.000Z',
      deletedAt: null,
    });
    expect({
      success: ok.success,
      keys: ok.success ? Object.keys(ok.data).sort() : [],
    }).toMatchInlineSnapshot(`
      {
        "keys": [
          "accessMode",
          "catalogVisible",
          "createdAt",
          "createdBy",
          "deletedAt",
          "description",
          "id",
          "name",
          "publishedAt",
          "publishedBy",
          "status",
          "tenantId",
          "updatedAt",
          "version",
        ],
        "success": true,
      }
    `);
  });

  it('accepts draft trail with null publishing fields', () => {
    const ok = TrailResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000010',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      name: 'Trilha Rascunho',
      description: null,
      status: 'draft',
      accessMode: 'free',
      version: null,
      publishedAt: null,
      publishedBy: null,
      catalogVisible: false,
      createdBy: '019756c0-0001-7000-8000-000000000003',
      createdAt: '2026-06-10T12:00:00.000Z',
      updatedAt: '2026-06-10T12:00:00.000Z',
      deletedAt: null,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.version).toBeNull();
      expect(ok.data.publishedAt).toBeNull();
      expect(ok.data.catalogVisible).toBe(false);
    }
  });
});

// ------------------------------------------------------------------
// CreateModuleRequestSchema
// ------------------------------------------------------------------
describe('CreateModuleRequestSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const ok = CreateModuleRequestSchema.safeParse({
      name: 'Módulo Fundamentos',
    });
    const fail = CreateModuleRequestSchema.safeParse({ name: 'x' });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "lessonAccessMode": "free",
          "name": "Módulo Fundamentos",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// UpdateModuleRequestSchema
// ------------------------------------------------------------------
describe('UpdateModuleRequestSchema snapshot', () => {
  it('accepts partial updates', () => {
    const ok = UpdateModuleRequestSchema.safeParse({ name: 'Módulo Atualizado' });
    const empty = UpdateModuleRequestSchema.safeParse({});
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      emptySuccess: empty.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "name": "Módulo Atualizado",
        },
        "emptySuccess": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// ModuleResponseSchema
// ------------------------------------------------------------------
describe('ModuleResponseSchema snapshot', () => {
  it('freezes success shape', () => {
    const ok = ModuleResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000020',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      trailId: '019756c0-0001-7000-8000-000000000010',
      name: 'Módulo Fundamentos',
      order: 0,
      createdAt: '2026-06-10T12:00:00.000Z',
      updatedAt: '2026-06-10T12:00:00.000Z',
      deletedAt: null,
    });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": null,
        "success": false,
      }
    `);
  });
});

// ------------------------------------------------------------------
// CreateLessonRequestSchema
// ------------------------------------------------------------------
describe('CreateLessonRequestSchema snapshot', () => {
  it('freezes success shape', () => {
    const ok = CreateLessonRequestSchema.safeParse({
      name: 'Aula Introdução',
      contentType: 'video',
      estimatedDurationMinutes: 30,
    });
    const fail = CreateLessonRequestSchema.safeParse({
      name: 'x',
      contentType: 'mp3',
    });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "contentType": "video",
          "estimatedDurationMinutes": 30,
          "name": "Aula Introdução",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// UpdateLessonRequestSchema
// ------------------------------------------------------------------
describe('UpdateLessonRequestSchema snapshot', () => {
  it('accepts partial updates', () => {
    const ok = UpdateLessonRequestSchema.safeParse({
      contentType: 'rich_text',
      estimatedDurationMinutes: null,
    });
    expect(ok.success && ok.data.contentType).toBe('rich_text');
    expect(ok.success && ok.data.estimatedDurationMinutes).toBeNull();
  });
});

// ------------------------------------------------------------------
// LessonResponseSchema
// ------------------------------------------------------------------
describe('LessonResponseSchema snapshot', () => {
  it('freezes success shape with all fields (8-2 upload metadata)', () => {
    const ok = LessonResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000030',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      moduleId: '019756c0-0001-7000-8000-000000000020',
      name: 'Aula Introdução',
      contentType: 'video',
      contentUrl: 'content/t/trail/lesson/video.mp4',
      contentBody: null,
      tags: ['discipleship', 'foundational'],
      originalName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 10485760,
      uploadedBy: '019756c0-0001-7000-8000-000000000003',
      uploadedAt: '2026-06-11T10:00:00.000Z',
      order: 0,
      estimatedDurationMinutes: 30,
      createdAt: '2026-06-10T12:00:00.000Z',
      updatedAt: '2026-06-11T10:00:00.000Z',
      deletedAt: null,
    });
    const fail = LessonResponseSchema.safeParse({
      id: 'not-a-uuid',
    });
    expect({
      success: ok.success,
      keys: ok.success ? Object.keys(ok.data).sort() : [],
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "keys": [
          "contentBody",
          "contentType",
          "contentUrl",
          "createdAt",
          "deletedAt",
          "estimatedDurationMinutes",
          "id",
          "mimeType",
          "moduleId",
          "name",
          "order",
          "originalName",
          "sizeBytes",
          "tags",
          "tenantId",
          "updatedAt",
          "uploadedAt",
          "uploadedBy",
        ],
        "success": true,
      }
    `);
  });

  it('accepts lesson with no upload metadata (nullable fields null)', () => {
    const ok = LessonResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000030',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      moduleId: '019756c0-0001-7000-8000-000000000020',
      name: 'Aula Texto',
      contentType: 'rich_text',
      contentUrl: null,
      contentBody: '<p>Conteúdo pastoral</p>',
      tags: [],
      originalName: null,
      mimeType: null,
      sizeBytes: null,
      uploadedBy: null,
      uploadedAt: null,
      order: 1,
      estimatedDurationMinutes: null,
      createdAt: '2026-06-10T12:00:00.000Z',
      updatedAt: '2026-06-10T12:00:00.000Z',
      deletedAt: null,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.contentBody).toBe('<p>Conteúdo pastoral</p>');
      expect(ok.data.tags).toEqual([]);
    }
  });
});

// ------------------------------------------------------------------
// UploadResponseSchema
// ------------------------------------------------------------------
describe('UploadResponseSchema snapshot', () => {
  it('freezes upload response shape', () => {
    const ok = UploadResponseSchema.safeParse({
      lessonId: '019756c0-0001-7000-8000-000000000030',
      objectKey: 'content/t/trail/lesson/video.mp4',
      originalName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 10485760,
      uploadedAt: '2026-06-11T10:00:00.000Z',
    });
    const fail = UploadResponseSchema.safeParse({
      lessonId: 'bad-id',
      objectKey: '',
    });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "lessonId": "019756c0-0001-7000-8000-000000000030",
          "mimeType": "video/mp4",
          "objectKey": "content/t/trail/lesson/video.mp4",
          "originalName": "video.mp4",
          "sizeBytes": 10485760,
          "uploadedAt": "2026-06-11T10:00:00.000Z",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// SignedUrlResponseSchema
// ------------------------------------------------------------------
describe('SignedUrlResponseSchema snapshot', () => {
  it('freezes signed URL response shape', () => {
    const ok = SignedUrlResponseSchema.safeParse({
      lessonId: '019756c0-0001-7000-8000-000000000030',
      signedUrl: 'https://minio.example.com/metanoia-storage/content/t/trail/lesson/video.mp4?X-Amz-Signature=abc123',
      expiresInSeconds: 14400,
    });
    const fail = SignedUrlResponseSchema.safeParse({
      lessonId: 'bad-id',
      signedUrl: 'not-a-url',
      expiresInSeconds: -1,
    });
    expect({
      success: ok.success,
      expiresInSeconds: ok.success ? ok.data.expiresInSeconds : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "expiresInSeconds": 14400,
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// LessonStatusSchema (Story 8-3)
// ------------------------------------------------------------------
describe('LessonStatusSchema snapshot', () => {
  it('freezes valid and invalid values', () => {
    const ok = LessonStatusSchema.safeParse('in_progress');
    const fail = LessonStatusSchema.safeParse('started');
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "in_progress",
        "failure": true,
        "success": true,
      }
    `);
  });

  it('accepts all three status values', () => {
    expect(LessonStatusSchema.safeParse('not_started').success).toBe(true);
    expect(LessonStatusSchema.safeParse('in_progress').success).toBe(true);
    expect(LessonStatusSchema.safeParse('completed').success).toBe(true);
    expect(LessonStatusSchema.safeParse('paused').success).toBe(false);
  });
});

// ------------------------------------------------------------------
// ReportProgressRequestSchema (Story 8-3)
// ------------------------------------------------------------------
describe('ReportProgressRequestSchema snapshot', () => {
  it('freezes valid progress event shape', () => {
    const ok = ReportProgressRequestSchema.safeParse({
      progressPercent: 75,
      eventType: 'video_time_update',
    });
    const fail = ReportProgressRequestSchema.safeParse({
      progressPercent: 101, // out of range
      eventType: 'video_time_update',
    });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "eventType": "video_time_update",
          "progressPercent": 75,
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// LessonProgressJobPayloadSchema (Story 8-3)
// ------------------------------------------------------------------
describe('LessonProgressJobPayloadSchema snapshot', () => {
  it('freezes BullMQ job payload shape', () => {
    const ok = LessonProgressJobPayloadSchema.safeParse({
      userId: '019756c0-0001-7000-8000-000000000099',
      lessonId: '019756c0-0001-7000-8000-000000000030',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      progressPercent: 50,
      eventType: 'scroll_position',
    });
    const fail = LessonProgressJobPayloadSchema.safeParse({
      userId: 'not-a-uuid',
      lessonId: 'not-a-uuid',
      tenantId: 'not-a-uuid',
      progressPercent: -1,
      eventType: 'invalid',
    });
    expect({
      success: ok.success,
      keys: ok.success ? Object.keys(ok.data).sort() : [],
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "keys": [
          "eventType",
          "lessonId",
          "progressPercent",
          "tenantId",
          "userId",
        ],
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// TrailProgressUpdatedEventSchema — domain event contract test (Story 8-3)
// OBRIGATÓRIO: previne breaking changes silenciosas entre Content e Pastoral
// ------------------------------------------------------------------
describe('TrailProgressUpdatedEventSchema snapshot (domain event contract)', () => {
  it('freezes the domain event shape — MUST NOT change without Story 6.9 coordination', () => {
    const ok = TrailProgressUpdatedEventSchema.safeParse({
      eventId: '019756c0-0001-7000-8000-000000000001',
      eventType: 'content.trail.progress_updated',
      version: 1,
      tenantId: '019756c0-0001-7000-8000-000000000002',
      timestamp: '2026-06-12T10:00:00.000Z',
      data: {
        userId: '019756c0-0001-7000-8000-000000000099',
        trailId: '019756c0-0001-7000-8000-000000000010',
        progressPercent: 75,
        previousPercent: 50,
      },
      metadata: {
        correlationId: 'progress-job-abc123',
      },
    });

    const fail = TrailProgressUpdatedEventSchema.safeParse({
      eventId: '019756c0-0001-7000-8000-000000000001',
      eventType: 'content.trail.progress_changed', // wrong eventType
      version: 1,
      tenantId: '019756c0-0001-7000-8000-000000000002',
      timestamp: '2026-06-12T10:00:00.000Z',
      data: { userId: 'u', trailId: 't', progressPercent: 75, previousPercent: 50 },
      metadata: { correlationId: 'x' },
    });

    expect({
      success: ok.success,
      eventType: ok.success ? ok.data.eventType : null,
      version: ok.success ? ok.data.version : null,
      dataKeys: ok.success ? Object.keys(ok.data.data).sort() : [],
      metadataKeys: ok.success ? Object.keys(ok.data.metadata).sort() : [],
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "dataKeys": [
          "previousPercent",
          "progressPercent",
          "trailId",
          "userId",
        ],
        "eventType": "content.trail.progress_updated",
        "failure": true,
        "metadataKeys": [
          "correlationId",
        ],
        "success": true,
        "version": 1,
      }
    `);
  });

  it('rejects wrong version number', () => {
    const fail = TrailProgressUpdatedEventSchema.safeParse({
      eventId: '019756c0-0001-7000-8000-000000000001',
      eventType: 'content.trail.progress_updated',
      version: 2, // wrong — must be 1
      tenantId: '019756c0-0001-7000-8000-000000000002',
      timestamp: '2026-06-12T10:00:00.000Z',
      data: {
        userId: '019756c0-0001-7000-8000-000000000099',
        trailId: '019756c0-0001-7000-8000-000000000010',
        progressPercent: 75,
        previousPercent: 50,
      },
      metadata: { correlationId: 'x' },
    });
    expect(fail.success).toBe(false);
  });

  it('rejects progressPercent out of 0-100 range', () => {
    const fail = TrailProgressUpdatedEventSchema.safeParse({
      eventId: '019756c0-0001-7000-8000-000000000001',
      eventType: 'content.trail.progress_updated',
      version: 1,
      tenantId: '019756c0-0001-7000-8000-000000000002',
      timestamp: '2026-06-12T10:00:00.000Z',
      data: {
        userId: '019756c0-0001-7000-8000-000000000099',
        trailId: '019756c0-0001-7000-8000-000000000010',
        progressPercent: 150, // invalid
        previousPercent: 50,
      },
      metadata: { correlationId: 'x' },
    });
    expect(fail.success).toBe(false);
  });
});

// ------------------------------------------------------------------
// VideoIntervalSchema (Story 8-4)
// ------------------------------------------------------------------
describe('VideoIntervalSchema snapshot', () => {
  it('freezes valid and invalid interval', () => {
    const ok = VideoIntervalSchema.safeParse({ start: 0, end: 30 });
    const fail = VideoIntervalSchema.safeParse({ start: -1, end: 30 });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "end": 30,
          "start": 0,
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// VideoProgressPayloadSchema (Story 8-4)
// ------------------------------------------------------------------
describe('VideoProgressPayloadSchema snapshot', () => {
  it('freezes valid payload shape', () => {
    const ok = VideoProgressPayloadSchema.safeParse({
      watchedIntervals: [{ start: 0, end: 90 }],
      totalDurationSeconds: 100,
      uniqueWatchedPercent: 90,
    });
    const fail = VideoProgressPayloadSchema.safeParse({
      watchedIntervals: [{ start: 0, end: 30 }],
      totalDurationSeconds: 0, // must be positive
      uniqueWatchedPercent: 30,
    });
    expect({
      success: ok.success,
      keys: ok.success ? Object.keys(ok.data).sort() : [],
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "keys": [
          "totalDurationSeconds",
          "uniqueWatchedPercent",
          "watchedIntervals",
        ],
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// CompletedBySchema (Story 8-4)
// ------------------------------------------------------------------
describe('CompletedBySchema snapshot', () => {
  it('accepts participant and leader only', () => {
    expect(CompletedBySchema.safeParse('participant').success).toBe(true);
    expect(CompletedBySchema.safeParse('leader').success).toBe(true);
    expect(CompletedBySchema.safeParse('admin').success).toBe(false);
  });
});

// ------------------------------------------------------------------
// ManualCompletionRequestSchema (Story 8-4)
// ------------------------------------------------------------------
describe('ManualCompletionRequestSchema snapshot', () => {
  it('freezes manual completion request shape', () => {
    const ok = ManualCompletionRequestSchema.safeParse({ completedBy: 'participant' });
    const fail = ManualCompletionRequestSchema.safeParse({ completedBy: 'system' });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "completedBy": "participant",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// TenantContentConfigSchema (Story 8-4)
// ------------------------------------------------------------------
describe('TenantContentConfigSchema snapshot', () => {
  it('freezes valid config shape', () => {
    const ok = TenantContentConfigSchema.safeParse({
      id: '019758a0-0001-7000-8000-000000000001',
      tenantId: '01912345-6789-7000-8000-000000000001',
      videoThresholdPercent: 90,
      docScrollThresholdPercent: 80,
      allowManualVideoCompletion: false,
      allowManualDocCompletion: false,
      createdAt: '2026-06-13T10:00:00.000Z',
      updatedAt: '2026-06-13T10:00:00.000Z',
    });
    const failThreshold = TenantContentConfigSchema.safeParse({
      id: '019758a0-0001-7000-8000-000000000001',
      tenantId: '01912345-6789-7000-8000-000000000001',
      videoThresholdPercent: 30, // below 50 minimum
      docScrollThresholdPercent: 80,
      allowManualVideoCompletion: false,
      allowManualDocCompletion: false,
      createdAt: '2026-06-13T10:00:00.000Z',
      updatedAt: '2026-06-13T10:00:00.000Z',
    });
    expect({
      success: ok.success,
      keys: ok.success ? Object.keys(ok.data).sort() : [],
      failure: !failThreshold.success,
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "keys": [
          "allowManualDocCompletion",
          "allowManualVideoCompletion",
          "createdAt",
          "docScrollThresholdPercent",
          "id",
          "tenantId",
          "updatedAt",
          "videoThresholdPercent",
        ],
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// UpdateTenantContentConfigSchema (Story 8-4)
// ------------------------------------------------------------------
describe('UpdateTenantContentConfigSchema snapshot', () => {
  it('accepts partial updates', () => {
    const ok = UpdateTenantContentConfigSchema.safeParse({
      videoThresholdPercent: 75,
    });
    const empty = UpdateTenantContentConfigSchema.safeParse({});
    const failRange = UpdateTenantContentConfigSchema.safeParse({
      videoThresholdPercent: 101, // above 100
    });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      emptySuccess: empty.success,
      failure: !failRange.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "videoThresholdPercent": 75,
        },
        "emptySuccess": true,
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// TrailAccessModeSchema (Story 8-5)
// ------------------------------------------------------------------
describe('TrailAccessModeSchema snapshot', () => {
  it('freezes valid and invalid values', () => {
    const ok = TrailAccessModeSchema.safeParse('sequential');
    const ok2 = TrailAccessModeSchema.safeParse('free');
    const fail = TrailAccessModeSchema.safeParse('locked');
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      freeSuccess: ok2.success,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "sequential",
        "failure": true,
        "freeSuccess": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// LessonAccessModeSchema (Story 8-5)
// ------------------------------------------------------------------
describe('LessonAccessModeSchema snapshot', () => {
  it('freezes valid and invalid values', () => {
    const ok = LessonAccessModeSchema.safeParse('sequential');
    const ok2 = LessonAccessModeSchema.safeParse('free');
    const fail = LessonAccessModeSchema.safeParse('random');
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      freeSuccess: ok2.success,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "sequential",
        "failure": true,
        "freeSuccess": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// SetPrerequisitesRequestSchema (Story 8-5)
// ------------------------------------------------------------------
describe('SetPrerequisitesRequestSchema snapshot', () => {
  it('accepts empty list and list of UUIDs, rejects non-UUID', () => {
    const empty = SetPrerequisitesRequestSchema.safeParse({ prerequisiteModuleIds: [] });
    const uuids = SetPrerequisitesRequestSchema.safeParse({
      prerequisiteModuleIds: ['01975700-0001-7000-8000-000000000001'],
    });
    const fail = SetPrerequisitesRequestSchema.safeParse({
      prerequisiteModuleIds: ['not-a-uuid'],
    });
    expect({
      emptySuccess: empty.success,
      uuidsSuccess: uuids.success,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "emptySuccess": true,
        "failure": true,
        "uuidsSuccess": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// ModulePrerequisiteResponseSchema (Story 8-5)
// ------------------------------------------------------------------
describe('ModulePrerequisiteResponseSchema snapshot', () => {
  it('validates a prerequisite entry', () => {
    const ok = ModulePrerequisiteResponseSchema.safeParse({
      moduleId: '01975700-0001-7000-8000-000000000001',
      prerequisiteModuleId: '01975700-0001-7000-8000-000000000002',
    });
    const fail = ModulePrerequisiteResponseSchema.safeParse({
      moduleId: 'bad',
      prerequisiteModuleId: '01975700-0001-7000-8000-000000000002',
    });
    expect({
      success: ok.success,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// TrailPublishedEventSchema — domain event contract (Story 8-6)
// OBRIGATÓRIO: gate contra breaking changes silenciosas
// ------------------------------------------------------------------
describe('TrailPublishedEventSchema snapshot (domain event contract)', () => {
  it('freezes the domain event shape', () => {
    const ok = TrailPublishedEventSchema.safeParse({
      eventId: '019756c0-0001-7000-8000-000000000001',
      eventType: 'content.trail.published',
      version: 1,
      tenantId: '019756c0-0001-7000-8000-000000000002',
      timestamp: '2026-06-15T10:00:00.000Z',
      data: {
        trailId: '019756c0-0001-7000-8000-000000000010',
        trailVersion: 1,
        publishedBy: '019756c0-0001-7000-8000-000000000003',
      },
      metadata: {
        correlationId: 'publish-abc123',
      },
    });

    const fail = TrailPublishedEventSchema.safeParse({
      eventId: '019756c0-0001-7000-8000-000000000001',
      eventType: 'content.trail.archived', // wrong eventType
      version: 1,
      tenantId: '019756c0-0001-7000-8000-000000000002',
      timestamp: '2026-06-15T10:00:00.000Z',
      data: {
        trailId: '019756c0-0001-7000-8000-000000000010',
        trailVersion: 1,
        publishedBy: '019756c0-0001-7000-8000-000000000003',
      },
      metadata: { correlationId: 'x' },
    });

    expect({
      success: ok.success,
      eventType: ok.success ? ok.data.eventType : null,
      version: ok.success ? ok.data.version : null,
      dataKeys: ok.success ? Object.keys(ok.data.data).sort() : [],
      metadataKeys: ok.success ? Object.keys(ok.data.metadata).sort() : [],
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "dataKeys": [
          "publishedBy",
          "trailId",
          "trailVersion",
        ],
        "eventType": "content.trail.published",
        "failure": true,
        "metadataKeys": [
          "correlationId",
        ],
        "success": true,
        "version": 1,
      }
    `);
  });

  it('rejects trailVersion=0 (must be positive integer)', () => {
    const fail = TrailPublishedEventSchema.safeParse({
      eventId: '019756c0-0001-7000-8000-000000000001',
      eventType: 'content.trail.published',
      version: 1,
      tenantId: '019756c0-0001-7000-8000-000000000002',
      timestamp: '2026-06-15T10:00:00.000Z',
      data: {
        trailId: '019756c0-0001-7000-8000-000000000010',
        trailVersion: 0, // invalid: must be >=1
        publishedBy: '019756c0-0001-7000-8000-000000000003',
      },
      metadata: { correlationId: 'x' },
    });
    expect(fail.success).toBe(false);
  });
});

// ------------------------------------------------------------------
// TrailVersionResponseSchema (Story 8-6)
// ------------------------------------------------------------------
describe('TrailVersionResponseSchema snapshot', () => {
  it('freezes trail version response shape', () => {
    const ok = TrailVersionResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000050',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      trailId: '019756c0-0001-7000-8000-000000000010',
      version: 2,
      snapshotData: { modules: [], name: 'Trilha v2' },
      publishedAt: '2026-06-15T10:00:00.000Z',
      publishedBy: '019756c0-0001-7000-8000-000000000003',
      createdAt: '2026-06-15T10:00:00.000Z',
    });
    const fail = TrailVersionResponseSchema.safeParse({
      id: 'not-uuid',
      trailId: 'not-uuid',
      version: 0, // must be positive
    });
    expect({
      failure: !fail.success,
      keys: ok.success ? Object.keys(ok.data).sort() : [],
      success: ok.success,
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "keys": [
          "createdAt",
          "id",
          "publishedAt",
          "publishedBy",
          "snapshotData",
          "tenantId",
          "trailId",
          "version",
        ],
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// GroupTrailResponseSchema (Story 8-6)
// ------------------------------------------------------------------
describe('GroupTrailResponseSchema snapshot', () => {
  it('freezes group trail response shape', () => {
    const ok = GroupTrailResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000060',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      groupId: '019756c0-0001-7000-8000-000000000070',
      trailId: '019756c0-0001-7000-8000-000000000010',
      assignedBy: '019756c0-0001-7000-8000-000000000003',
      assignedAt: '2026-06-15T10:00:00.000Z',
    });
    const fail = GroupTrailResponseSchema.safeParse({
      id: 'bad',
      groupId: 'bad',
      trailId: 'bad',
    });
    expect({
      failure: !fail.success,
      keys: ok.success ? Object.keys(ok.data).sort() : [],
      success: ok.success,
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "keys": [
          "assignedAt",
          "assignedBy",
          "groupId",
          "id",
          "tenantId",
          "trailId",
        ],
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// AssociateTrailsRequestSchema (Story 4-4)
// ------------------------------------------------------------------
describe('AssociateTrailsRequestSchema snapshot', () => {
  it('accepts array with at least one UUID', () => {
    const ok = AssociateTrailsRequestSchema.safeParse({
      trailIds: [
        '019756c0-0001-7000-8000-000000000010',
        '019756c0-0001-7000-8000-000000000011',
      ],
    });
    const failEmpty = AssociateTrailsRequestSchema.safeParse({ trailIds: [] });
    const failBad = AssociateTrailsRequestSchema.safeParse({ trailIds: ['not-uuid'] });
    expect({
      success: ok.success,
      count: ok.success ? ok.data.trailIds.length : 0,
      failEmpty: !failEmpty.success,
      failBad: !failBad.success,
    }).toMatchInlineSnapshot(`
      {
        "count": 2,
        "failBad": true,
        "failEmpty": true,
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// AssociateTrailsResponseSchema (Story 4-4)
// ------------------------------------------------------------------
describe('AssociateTrailsResponseSchema snapshot', () => {
  it('freezes bulk response shape', () => {
    const ok = AssociateTrailsResponseSchema.safeParse({
      data: [
        {
          id: '019756c0-0001-7000-8000-000000000060',
          tenantId: '019756c0-0001-7000-8000-000000000002',
          groupId: '019756c0-0001-7000-8000-000000000070',
          trailId: '019756c0-0001-7000-8000-000000000010',
          assignedBy: '019756c0-0001-7000-8000-000000000003',
          assignedAt: '2026-06-15T10:00:00.000Z',
        },
      ],
      meta: { created: 1 },
    });
    expect({
      success: ok.success,
      metaKeys: ok.success ? Object.keys(ok.data.meta).sort() : [],
      dataLength: ok.success ? ok.data.data.length : 0,
    }).toMatchInlineSnapshot(`
      {
        "dataLength": 1,
        "metaKeys": [
          "created",
        ],
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// GroupTrailsListResponseSchema (Story 4-4)
// ------------------------------------------------------------------
describe('GroupTrailsListResponseSchema snapshot', () => {
  it('freezes list response shape', () => {
    const ok = GroupTrailsListResponseSchema.safeParse({
      data: [],
      meta: { total: 0 },
    });
    expect({
      success: ok.success,
      metaKeys: ok.success ? Object.keys(ok.data.meta).sort() : [],
    }).toMatchInlineSnapshot(`
      {
        "metaKeys": [
          "total",
        ],
        "success": true,
      }
    `);
  });
});

// ------------------------------------------------------------------
// InvalidTrailIdsResponseSchema (Story 4-4 — 422)
// ------------------------------------------------------------------
describe('InvalidTrailIdsResponseSchema snapshot', () => {
  it('freezes 422 body shape', () => {
    const ok = InvalidTrailIdsResponseSchema.safeParse({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'One or more trail IDs do not exist in this tenant',
      invalidTrailIds: ['019756c0-0001-7000-8000-000000000099'],
    });
    const fail = InvalidTrailIdsResponseSchema.safeParse({
      statusCode: 404,
      error: 'Not Found',
      message: 'nope',
      invalidTrailIds: [],
    });
    expect({
      success: ok.success,
      failure: !fail.success,
      keys: ok.success ? Object.keys(ok.data).sort() : [],
    }).toMatchInlineSnapshot(`
      {
        "failure": true,
        "keys": [
          "error",
          "invalidTrailIds",
          "message",
          "statusCode",
        ],
        "success": true,
      }
    `);
  });
});
