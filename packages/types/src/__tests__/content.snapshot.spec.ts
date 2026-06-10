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
// TrailResponseSchema
// ------------------------------------------------------------------
describe('TrailResponseSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const ok = TrailResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000010',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      name: 'Trilha de Discipulado',
      description: null,
      status: 'draft',
      createdBy: '019756c0-0001-7000-8000-000000000003',
      createdAt: '2026-06-10T12:00:00.000Z',
      updatedAt: '2026-06-10T12:00:00.000Z',
      deletedAt: null,
    });
    const fail = TrailResponseSchema.safeParse({
      id: 'not-a-uuid',
      tenantId: 'not-a-uuid',
      name: 'x',
      status: 'unknown',
      createdBy: 'not-a-uuid',
      createdAt: 'bad',
      updatedAt: 'bad',
    });
    expect({
      success: ok.success,
      data: ok.success ? ok.data : null,
      failure: !fail.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "createdAt": "2026-06-10T12:00:00.000Z",
          "createdBy": "019756c0-0001-7000-8000-000000000003",
          "deletedAt": null,
          "description": null,
          "id": "019756c0-0001-7000-8000-000000000010",
          "name": "Trilha de Discipulado",
          "status": "draft",
          "tenantId": "019756c0-0001-7000-8000-000000000002",
          "updatedAt": "2026-06-10T12:00:00.000Z",
        },
        "failure": true,
        "success": true,
      }
    `);
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
        "data": {
          "createdAt": "2026-06-10T12:00:00.000Z",
          "deletedAt": null,
          "id": "019756c0-0001-7000-8000-000000000020",
          "name": "Módulo Fundamentos",
          "order": 0,
          "tenantId": "019756c0-0001-7000-8000-000000000002",
          "trailId": "019756c0-0001-7000-8000-000000000010",
          "updatedAt": "2026-06-10T12:00:00.000Z",
        },
        "success": true,
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
