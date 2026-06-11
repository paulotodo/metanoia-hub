/**
 * Unit tests for AuditExportProcessor.
 *
 * Covers:
 *   - processExportJob: builds CSV with BOM + all 12 fields
 *   - processExportJob: serializes previousState/newState as JSON string (dec-021)
 *   - processExportJob: uploads to storage + sets Redis state = completed
 *   - processExportJob: handles failures → sets Redis state = failed
 *   - processExportJob: cross-tenant (non-null tenantId) forwarded to listEvents
 *   - processExportJob: tenant-scoped (null tenantId = undefined) call
 *   - onModuleInit: registers BullMQ worker on AUDIT_EXPORT_QUEUE_NAME
 *
 * Story 9-3 (LGPD — Immutable Audit Log) — FASE 2.7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditExportProcessor } from './audit-export.processor';
import {
  AUDIT_EXPORT_QUEUE_NAME,
  AUDIT_EXPORT_TTL_SECONDS,
  type AuditExportJobPayload,
} from '@metanoia/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUpload = vi.fn().mockResolvedValue(undefined);
const mockGetSignedUrl = vi.fn().mockResolvedValue('https://minio/exports/job-01.csv');
const mockStorage = { upload: mockUpload, getSignedUrl: mockGetSignedUrl };

const mockRedisSet = vi.fn().mockResolvedValue('OK');
const mockRedis = { set: mockRedisSet };

let capturedWorkerHandler: ((job: { name: string; data: unknown }) => Promise<void>) | null = null;
const mockBullMq = {
  createWorker: vi.fn((queueName: string, handler: typeof capturedWorkerHandler) => {
    capturedWorkerHandler = handler;
    return {};
  }),
  createQueue: vi.fn(),
};

const mockListEvents = vi.fn();
const mockAuditService = { listEvents: mockListEvents };

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AuditEventRow = {
  id: string;
  tenantId: string;
  userId: string;
  action: 'create' | 'delete' | 'update' | 'login' | 'logout' | 'auth_failure' | 'config_change' | 'export';
  resource: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
};

function makeAuditEventRow(overrides: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    id: 'evt-01',
    tenantId: 'tenant-01',
    userId: 'user-01',
    action: 'create' as const,
    resource: 'group',
    resourceId: 'group-01',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest/test',
    previousState: null as Record<string, unknown> | null,
    newState: { id: 'group-01', name: 'Test' } as Record<string, unknown> | null,
    timestamp: '2026-06-11T10:00:00.000Z',
    severity: 'info' as const,
    ...overrides,
  };
}

function makePayload(overrides: Partial<AuditExportJobPayload> = {}): AuditExportJobPayload {
  return {
    jobId: 'job-01',
    tenantId: null,
    requestedBy: 'user-admin-01',
    query: {},
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuditExportProcessor', () => {
  let processor: AuditExportProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedWorkerHandler = null;

    processor = new AuditExportProcessor(
      mockBullMq as unknown as ConstructorParameters<typeof AuditExportProcessor>[0],
      mockAuditService as unknown as ConstructorParameters<typeof AuditExportProcessor>[1],
      mockRedis as unknown as ConstructorParameters<typeof AuditExportProcessor>[2],
      mockStorage as unknown as ConstructorParameters<typeof AuditExportProcessor>[3],
    );
    processor.onModuleInit();
  });

  // ─── onModuleInit ─────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('registers BullMQ worker on AUDIT_EXPORT_QUEUE_NAME', () => {
      expect(mockBullMq.createWorker).toHaveBeenCalledWith(
        AUDIT_EXPORT_QUEUE_NAME,
        expect.any(Function),
      );
    });

    it('worker handler calls processExportJob only for export-audit-csv jobs', async () => {
      const processExportJobSpy = vi.spyOn(processor, 'processExportJob').mockResolvedValue();
      await capturedWorkerHandler!({ name: 'export-audit-csv', data: makePayload() });
      expect(processExportJobSpy).toHaveBeenCalledOnce();

      processExportJobSpy.mockClear();
      await capturedWorkerHandler!({ name: 'other-job', data: {} });
      expect(processExportJobSpy).not.toHaveBeenCalled();
    });
  });

  // ─── processExportJob — success path ─────────────────────────────────────

  describe('processExportJob — success', () => {
    it('calls listEvents with perPage=10000 (full export)', async () => {
      mockListEvents.mockResolvedValue({ data: [], meta: { page: 1, perPage: 10000, total: 0, totalPages: 0 } });

      await processor.processExportJob(makePayload());

      expect(mockListEvents).toHaveBeenCalledWith(
        expect.objectContaining({ perPage: 10000, page: 1 }),
        undefined,
      );
    });

    it('forwards non-null tenantId to listEvents for cross-tenant export', async () => {
      mockListEvents.mockResolvedValue({ data: [], meta: { page: 1, perPage: 10000, total: 0, totalPages: 0 } });

      await processor.processExportJob(makePayload({ tenantId: 'tenant-B' }));

      expect(mockListEvents).toHaveBeenCalledWith(
        expect.anything(),
        'tenant-B',
      );
    });

    it('generates CSV with BOM (UTF-8) as first bytes', async () => {
      const row = makeAuditEventRow();
      mockListEvents.mockResolvedValue({ data: [row], meta: {} });

      await processor.processExportJob(makePayload());

      const uploadCall = mockUpload.mock.calls[0];
      const csvBuffer = uploadCall![1] as Buffer;
      const csvStr = csvBuffer.toString('utf-8');
      // UTF-8 BOM:
      expect(csvStr.charCodeAt(0)).toBe(0xFEFF);
    });

    it('CSV contains all 12 required headers', async () => {
      mockListEvents.mockResolvedValue({ data: [], meta: {} });

      await processor.processExportJob(makePayload());

      const csvBuffer = mockUpload.mock.calls[0]![1] as Buffer;
      const csvStr = csvBuffer.toString('utf-8').replace('﻿', '');
      const headerLine = csvStr.split('\n')[0] ?? '';

      const requiredHeaders = [
        'id', 'tenantId', 'userId', 'action', 'resource', 'resourceId',
        'ipAddress', 'userAgent', 'previousState', 'newState', 'timestamp', 'severity',
      ];
      for (const h of requiredHeaders) {
        expect(headerLine).toContain(h);
      }
    });

    it('serializes newState as JSON string in CSV cell (dec-021)', async () => {
      const newState = { id: 'g-01', name: 'Group One' };
      const row = makeAuditEventRow({ newState });
      mockListEvents.mockResolvedValue({ data: [row], meta: {} });

      await processor.processExportJob(makePayload());

      const csvBuffer = mockUpload.mock.calls[0]![1] as Buffer;
      const csvStr = csvBuffer.toString('utf-8');
      // In CSV, the JSON cell is double-quoted and inner quotes are escaped as ""
      // e.g. "{""id"":""g-01"",""name"":""Group One""}"
      const jsonStr = JSON.stringify(newState);
      const escapedInCell = jsonStr.replace(/"/g, '""');
      expect(csvStr).toContain(escapedInCell);
    });

    it('serializes previousState as JSON string (dec-021)', async () => {
      const previousState = { id: 'g-01', name: 'Old Name' };
      const row = makeAuditEventRow({ previousState });
      mockListEvents.mockResolvedValue({ data: [row], meta: {} });

      await processor.processExportJob(makePayload());

      const csvBuffer = mockUpload.mock.calls[0]![1] as Buffer;
      const csvStr = csvBuffer.toString('utf-8');
      const jsonStr = JSON.stringify(previousState);
      const escapedInCell = jsonStr.replace(/"/g, '""');
      expect(csvStr).toContain(escapedInCell);
    });

    it('leaves previousState and newState empty string when null', async () => {
      const row = makeAuditEventRow({ previousState: null, newState: null });
      mockListEvents.mockResolvedValue({ data: [row], meta: {} });

      await processor.processExportJob(makePayload());

      const csvBuffer = mockUpload.mock.calls[0]![1] as Buffer;
      const csvStr = csvBuffer.toString('utf-8');
      // Both null fields appear as empty quoted cells
      const dataLine = csvStr.split('\n')[1] ?? '';
      // The row should contain at least two consecutive empty cells ("","")
      expect(dataLine).toContain('""');
    });

    it('uploads CSV to correct MinIO path', async () => {
      mockListEvents.mockResolvedValue({ data: [], meta: {} });

      await processor.processExportJob(makePayload({ jobId: 'job-upload-01' }));

      expect(mockUpload).toHaveBeenCalledWith(
        'audit-exports/job-upload-01.csv',
        expect.any(Buffer),
        'text/csv',
      );
    });

    it('sets Redis state = completed with signedUrl + expiresAt', async () => {
      mockListEvents.mockResolvedValue({ data: [], meta: {} });
      mockGetSignedUrl.mockResolvedValue('https://minio/exports/job-01.csv');

      await processor.processExportJob(makePayload({ jobId: 'job-01' }));

      const redisSetCall = mockRedisSet.mock.calls[0];
      const key = redisSetCall![0] as string;
      const value = JSON.parse(redisSetCall![1] as string);
      const ttl = redisSetCall![3];

      expect(key).toContain('job-01');
      expect(value.status).toBe('completed');
      expect(value.signedUrl).toBe('https://minio/exports/job-01.csv');
      expect(value.expiresAt).toBeTruthy();
      expect(ttl).toBe(AUDIT_EXPORT_TTL_SECONDS);
    });

    it('calls getSignedUrl with AUDIT_EXPORT_TTL_SECONDS', async () => {
      mockListEvents.mockResolvedValue({ data: [], meta: {} });

      await processor.processExportJob(makePayload({ jobId: 'job-01' }));

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        'audit-exports/job-01.csv',
        AUDIT_EXPORT_TTL_SECONDS,
      );
    });
  });

  // ─── processExportJob — failure path ─────────────────────────────────────

  describe('processExportJob — failure', () => {
    it('sets Redis state = failed with failureReason on error', async () => {
      mockListEvents.mockRejectedValue(new Error('DB connection lost'));

      await processor.processExportJob(makePayload({ jobId: 'job-fail-01' }));

      const redisSetCall = mockRedisSet.mock.calls[0];
      const value = JSON.parse(redisSetCall![1] as string);

      expect(value.status).toBe('failed');
      expect(value.failureReason).toBe('DB connection lost');
      expect(value.signedUrl).toBeNull();
    });

    it('sets failureReason = Unknown error for non-Error throws', async () => {
      mockListEvents.mockRejectedValue('string error');

      await processor.processExportJob(makePayload({ jobId: 'job-fail-02' }));

      const redisSetCall = mockRedisSet.mock.calls[0];
      const value = JSON.parse(redisSetCall![1] as string);

      expect(value.status).toBe('failed');
      expect(value.failureReason).toBe('Unknown error');
    });

    it('does NOT throw when processing fails (graceful error handling)', async () => {
      mockListEvents.mockRejectedValue(new Error('Storage unavailable'));

      // Must resolve, not reject
      await expect(processor.processExportJob(makePayload())).resolves.toBeUndefined();
    });
  });
});
