import { describe, it, expect } from 'vitest';
import {
  ImportResultSummarySchema,
  ImportJobStatusSchema,
  ImportRequestSchema,
  IMPORT_SYNC_THRESHOLD,
  IMPORT_MAX_ROWS,
  CSV_IMPORT_QUEUE_NAME,
  CSV_IMPORT_JOB_TTL_SECONDS,
} from '../onboarding/csv-import-result';

describe('csv-import-result constants snapshot', () => {
  it('freezes all exported constants', () => {
    expect({
      IMPORT_SYNC_THRESHOLD,
      IMPORT_MAX_ROWS,
      CSV_IMPORT_QUEUE_NAME,
      CSV_IMPORT_JOB_TTL_SECONDS,
    }).toMatchInlineSnapshot(`
      {
        "CSV_IMPORT_JOB_TTL_SECONDS": 86400,
        "CSV_IMPORT_QUEUE_NAME": "csv-import",
        "IMPORT_MAX_ROWS": 5000,
        "IMPORT_SYNC_THRESHOLD": 100,
      }
    `);
  });
});

describe('ImportRequestSchema snapshot', () => {
  it('accepts valid import request', () => {
    const result = ImportRequestSchema.safeParse({
      defaultGroupId: '019078ab-0000-7000-8000-000000000001',
      rows: [
        {
          nome: 'João Silva',
          email: 'joao@example.com',
          papel: 'participante',
          rowIndex: 0,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty rows array', () => {
    const result = ImportRequestSchema.safeParse({
      defaultGroupId: '019078ab-0000-7000-8000-000000000001',
      rows: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = ImportRequestSchema.safeParse({
      defaultGroupId: '019078ab-0000-7000-8000-000000000001',
      rows: [{ nome: 'Test', email: 'not-an-email', papel: 'participante', rowIndex: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('ImportResultSummarySchema snapshot', () => {
  const validSummary = {
    total: 3,
    imported: 1,
    existing: 1,
    invited: 1,
    failed: 0,
    lines: [
      { rowIndex: 0, email: 'a@example.com', nome: 'Alice', groupName: 'Grupo A', action: 'created' as const },
      { rowIndex: 1, email: 'b@example.com', nome: 'Bob', groupName: 'Grupo A', action: 'existing' as const },
      { rowIndex: 2, email: 'c@example.com', nome: 'Carol', groupName: 'Grupo A', action: 'invited' as const },
    ],
    reportUrl: null,
    jobId: null,
  };

  it('accepts valid summary', () => {
    expect(ImportResultSummarySchema.safeParse(validSummary).success).toBe(true);
  });

  it('freezes shape of keys', () => {
    const result = ImportResultSummarySchema.safeParse(validSummary);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toMatchInlineSnapshot(`
        [
          "existing",
          "failed",
          "imported",
          "invited",
          "jobId",
          "lines",
          "reportUrl",
          "total",
        ]
      `);
    }
  });
});

describe('ImportJobStatusSchema snapshot', () => {
  it('accepts processing state', () => {
    const result = ImportJobStatusSchema.safeParse({
      jobId: '019078ab-0000-7000-8000-000000000001',
      status: 'processing',
      progress: 42,
      result: null,
      failureReason: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects progress > 100', () => {
    const result = ImportJobStatusSchema.safeParse({
      jobId: '019078ab-0000-7000-8000-000000000001',
      status: 'processing',
      progress: 101,
      result: null,
      failureReason: null,
    });
    expect(result.success).toBe(false);
  });
});
