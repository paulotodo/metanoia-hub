import { describe, it, expect } from 'vitest';
import {
  TrailReportQuerySchema,
  TrailReportParticipantSchema,
  TrailSummarySchema,
  ExportJobStatusInnerSchema,
} from '../reports';

describe('TrailReportQuerySchema snapshot', () => {
  it('freezes defaults and coercion', () => {
    const result = TrailReportQuerySchema.safeParse({});
    expect({ success: result.success, data: result.success ? result.data : null }).toMatchInlineSnapshot(`
      {
        "data": {
          "page": 1,
          "perPage": 20,
        },
        "success": true,
      }
    `);
  });

  it('rejects invalid status', () => {
    const result = TrailReportQuerySchema.safeParse({ status: 'unknown' });
    expect(result.success).toBe(false);
  });

  it('accepts optional filters', () => {
    const result = TrailReportQuerySchema.safeParse({
      page: 2,
      perPage: 50,
      status: 'in_progress',
      lastActivityAfter: '2026-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('in_progress');
      expect(result.data.page).toBe(2);
    }
  });
});

describe('TrailReportParticipantSchema snapshot', () => {
  it('freezes valid participant shape', () => {
    const valid = {
      userId: '019078ab-0000-7000-8000-000000000001',
      name: 'Maria Silva',
      email: 'maria@igreja.com',
      progressPercent: 75,
      completedModules: 3,
      totalModules: 4,
      completedLessons: 9,
      totalLessons: 12,
      lastActivityAt: '2026-06-01T10:00:00Z',
      status: 'in_progress',
    };
    const result = TrailReportParticipantSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts null lastActivityAt', () => {
    const result = TrailReportParticipantSchema.safeParse({
      userId: '019078ab-0000-7000-8000-000000000001',
      name: 'João',
      email: 'joao@igreja.com',
      progressPercent: 0,
      completedModules: 0,
      totalModules: 4,
      completedLessons: 0,
      totalLessons: 12,
      lastActivityAt: null,
      status: 'not_started',
    });
    expect(result.success).toBe(true);
  });
});

describe('ExportJobStatusInnerSchema snapshot', () => {
  it('freezes processing shape', () => {
    const result = ExportJobStatusInnerSchema.safeParse({
      jobId: 'job-abc-123',
      status: 'processing',
      signedUrl: null,
      expiresAt: null,
      failureReason: null,
    });
    expect({ success: result.success, data: result.success ? result.data : null }).toMatchInlineSnapshot(`
      {
        "data": {
          "expiresAt": null,
          "failureReason": null,
          "jobId": "job-abc-123",
          "signedUrl": null,
          "status": "processing",
        },
        "success": true,
      }
    `);
  });
});

describe('TrailSummarySchema snapshot', () => {
  it('freezes valid summary shape', () => {
    const result = TrailSummarySchema.safeParse({
      trailId: '019078ab-0000-7000-8000-000000000001',
      trailName: 'Fundamentos da Fé',
      status: 'published',
      totalParticipants: 42,
      avgProgressPercent: 65.5,
      completedCount: 10,
      inProgressCount: 25,
      notStartedCount: 7,
    });
    expect(result.success).toBe(true);
  });
});
