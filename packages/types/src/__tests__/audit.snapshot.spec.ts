import { describe, it, expect } from 'vitest';
import {
  AuditActionSchema,
  AuditSeveritySchema,
  AuditEventSchema,
  AuditEventsQuerySchema,
  AuditExportJobStatusSchema,
  AUDIT_ACTIONS,
  AUDIT_SEVERITIES,
  AUDIT_WARNING_RESOURCES,
  AUDIT_EVENTS_PAGE_SIZE,
  AUDIT_EXPORT_QUEUE_NAME,
  AUDIT_EXPORT_TTL_SECONDS,
  AUDIT_PAYLOAD_TRUNCATE_BYTES,
} from '../audit';

// ─── Constants ─────────────────────────────────────────────────────────────────

describe('Audit constants snapshot', () => {
  it('freezes all exported constants', () => {
    expect({
      AUDIT_EVENTS_PAGE_SIZE,
      AUDIT_EXPORT_QUEUE_NAME,
      AUDIT_EXPORT_TTL_SECONDS,
      AUDIT_PAYLOAD_TRUNCATE_BYTES,
      AUDIT_ACTIONS,
      AUDIT_SEVERITIES,
      AUDIT_WARNING_RESOURCES,
    }).toMatchInlineSnapshot(`
      {
        "AUDIT_ACTIONS": [
          "create",
          "update",
          "delete",
          "login",
          "logout",
          "auth_failure",
          "config_change",
          "export",
          "import",
          "plan_limits_override",
        ],
        "AUDIT_EVENTS_PAGE_SIZE": 50,
        "AUDIT_EXPORT_QUEUE_NAME": "audit-export",
        "AUDIT_EXPORT_TTL_SECONDS": 3600,
        "AUDIT_PAYLOAD_TRUNCATE_BYTES": 65536,
        "AUDIT_SEVERITIES": [
          "info",
          "warning",
          "critical",
        ],
        "AUDIT_WARNING_RESOURCES": [
          "role",
          "permission",
          "user-role",
          "group-role",
          "member-role",
        ],
      }
    `);
  });
});

// ─── AuditActionSchema ─────────────────────────────────────────────────────────

describe('AuditActionSchema', () => {
  it('accepts all canonical actions', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(AuditActionSchema.safeParse(action).success).toBe(true);
    }
  });

  it('includes plan_limits_override (Story 11-1)', () => {
    expect(AUDIT_ACTIONS).toContain('plan_limits_override');
    expect(AuditActionSchema.safeParse('plan_limits_override').success).toBe(true);
  });

  it('rejects unknown action', () => {
    expect(AuditActionSchema.safeParse('hack').success).toBe(false);
  });
});

// ─── AuditSeveritySchema ───────────────────────────────────────────────────────

describe('AuditSeveritySchema', () => {
  it('accepts all canonical severities', () => {
    for (const sev of AUDIT_SEVERITIES) {
      expect(AuditSeveritySchema.safeParse(sev).success).toBe(true);
    }
  });

  it('rejects unknown severity', () => {
    expect(AuditSeveritySchema.safeParse('danger').success).toBe(false);
  });
});

// ─── AuditEventSchema ─────────────────────────────────────────────────────────

describe('AuditEventSchema', () => {
  const validEvent = {
    id: '019078ab-0000-7000-8000-000000000001',
    tenantId: '019078ab-0000-7000-8000-000000000002',
    userId: '019078ab-0000-7000-8000-000000000003',
    action: 'create' as const,
    resource: 'user',
    resourceId: '019078ab-0000-7000-8000-000000000004',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    previousState: null,
    newState: { name: 'João Silva' },
    timestamp: '2026-06-11T12:00:00Z',
    severity: 'info' as const,
  };

  it('accepts valid audit event with all 12 fields', () => {
    const result = AuditEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('accepts null userId (public route capture)', () => {
    const result = AuditEventSchema.safeParse({ ...validEvent, userId: null });
    expect(result.success).toBe(true);
  });

  it('accepts null previousState and newState', () => {
    const result = AuditEventSchema.safeParse({
      ...validEvent,
      previousState: null,
      newState: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null resourceId', () => {
    const result = AuditEventSchema.safeParse({ ...validEvent, resourceId: null });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { action, ...withoutAction } = validEvent;
    expect(AuditEventSchema.safeParse(withoutAction).success).toBe(false);
  });

  it('rejects invalid action', () => {
    expect(AuditEventSchema.safeParse({ ...validEvent, action: 'noop' }).success).toBe(false);
  });

  it('freezes valid event shape', () => {
    const result = AuditEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toMatchInlineSnapshot(`
        [
          "action",
          "id",
          "ipAddress",
          "newState",
          "previousState",
          "resource",
          "resourceId",
          "severity",
          "tenantId",
          "timestamp",
          "userAgent",
          "userId",
        ]
      `);
    }
  });
});

// ─── AuditEventsQuerySchema ────────────────────────────────────────────────────

describe('AuditEventsQuerySchema', () => {
  it('applies defaults when empty input', () => {
    const result = AuditEventsQuerySchema.safeParse({});
    expect({ success: result.success, data: result.success ? result.data : null }).toMatchInlineSnapshot(`
      {
        "data": {
          "page": 1,
          "perPage": 50,
        },
        "success": true,
      }
    `);
  });

  it('accepts all optional filters', () => {
    const result = AuditEventsQuerySchema.safeParse({
      page: 2,
      perPage: 25,
      action: 'delete',
      severity: 'critical',
      userId: '019078ab-0000-7000-8000-000000000001',
      resource: 'user',
      q: 'pastor',
      dateFrom: '2026-01-01T00:00:00Z',
      dateTo: '2026-12-31T23:59:59Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action in query', () => {
    expect(AuditEventsQuerySchema.safeParse({ action: 'noop' }).success).toBe(false);
  });

  it('rejects perPage > 100', () => {
    expect(AuditEventsQuerySchema.safeParse({ perPage: 200 }).success).toBe(false);
  });
});

// ─── AuditExportJobStatusSchema ────────────────────────────────────────────────

describe('AuditExportJobStatusSchema', () => {
  it('accepts processing state', () => {
    const result = AuditExportJobStatusSchema.safeParse({
      jobId: 'job-audit-123',
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
          "jobId": "job-audit-123",
          "signedUrl": null,
          "status": "processing",
        },
        "success": true,
      }
    `);
  });

  it('accepts completed state with signed URL', () => {
    const result = AuditExportJobStatusSchema.safeParse({
      jobId: 'job-audit-456',
      status: 'completed',
      signedUrl: 'https://minio.example.com/audit-export-123.csv?sig=abc',
      expiresAt: '2026-06-11T13:00:00Z',
      failureReason: null,
    });
    expect(result.success).toBe(true);
  });
});
