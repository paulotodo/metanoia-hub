import { http, HttpResponse } from 'msw';
import type { AuditEvent, AuditEventListResponse } from '@metanoia/types';

const TENANT_ID = '019800a0-0000-7000-8000-000000000001';
const USER_ID = '019800a0-0000-7000-8000-000000000099';

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: '019800b0-0000-7000-8000-000000000001',
    tenantId: TENANT_ID,
    userId: USER_ID,
    action: 'create',
    resource: 'group',
    resourceId: 'grp-001',
    ipAddress: '192.168.1.10',
    userAgent: 'Mozilla/5.0',
    previousState: null,
    newState: { name: 'Grupo Alpha', status: 'active' },
    timestamp: '2026-06-11T10:00:00.000Z',
    severity: 'info',
  },
  {
    id: '019800b0-0000-7000-8000-000000000002',
    tenantId: TENANT_ID,
    userId: USER_ID,
    action: 'update',
    resource: 'role',
    resourceId: 'role-admin',
    ipAddress: '192.168.1.10',
    userAgent: 'Mozilla/5.0',
    previousState: { level: 'member' },
    newState: { level: 'admin' },
    timestamp: '2026-06-11T10:05:00.000Z',
    severity: 'warning',
  },
  {
    id: '019800b0-0000-7000-8000-000000000003',
    tenantId: TENANT_ID,
    userId: USER_ID,
    action: 'delete',
    resource: 'member',
    resourceId: 'mem-007',
    ipAddress: '10.0.0.1',
    userAgent: 'curl/7.88',
    previousState: { name: 'João Silva', active: true },
    newState: null,
    timestamp: '2026-06-11T10:10:00.000Z',
    severity: 'critical',
  },
  {
    id: '019800b0-0000-7000-8000-000000000004',
    tenantId: TENANT_ID,
    userId: null,
    action: 'auth_failure',
    resource: 'auth',
    resourceId: null,
    ipAddress: '203.0.113.5',
    userAgent: 'python-httpx/0.24',
    previousState: null,
    newState: null,
    timestamp: '2026-06-11T10:15:00.000Z',
    severity: 'critical',
  },
  {
    id: '019800b0-0000-7000-8000-000000000005',
    tenantId: TENANT_ID,
    userId: USER_ID,
    action: 'login',
    resource: 'auth',
    resourceId: null,
    ipAddress: '192.168.1.10',
    userAgent: 'Mozilla/5.0',
    previousState: null,
    newState: null,
    timestamp: '2026-06-11T09:58:00.000Z',
    severity: 'info',
  },
];

function paginateEvents(
  events: AuditEvent[],
  page: number,
  perPage: number,
): AuditEventListResponse {
  const total = events.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    data: events.slice(start, start + perPage),
    meta: { page: safePage, perPage, total, totalPages },
  };
}

export const auditEventsHandlers = [
  // admin_tenant endpoint
  http.get('*/api/v1/audit-events', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const perPage = Number(url.searchParams.get('perPage') ?? 50);
    const actionFilter = url.searchParams.get('action');
    const severityFilter = url.searchParams.get('severity');

    let filtered = MOCK_AUDIT_EVENTS;
    if (actionFilter) filtered = filtered.filter((e) => e.action === actionFilter);
    if (severityFilter) filtered = filtered.filter((e) => e.severity === severityFilter);

    return HttpResponse.json({ ...paginateEvents(filtered, page, perPage) });
  }),

  // admin_tenant export trigger
  http.post('*/api/v1/audit-events/exports', () => {
    return HttpResponse.json(
      { data: { jobId: 'job-mock-001' } },
      { status: 202 },
    );
  }),

  // admin_tenant export status
  http.get('*/api/v1/audit-events/exports/:jobId', ({ params }) => {
    return HttpResponse.json({
      data: {
        jobId: params.jobId,
        status: 'completed',
        signedUrl: 'https://storage.example.com/exports/audit-export.csv?token=mock',
        expiresAt: '2026-06-12T10:00:00.000Z',
        failureReason: null,
      },
    });
  }),

  // super-admin endpoint
  http.get('*/api/v1/super-admin/audit-events', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const perPage = Number(url.searchParams.get('perPage') ?? 50);
    return HttpResponse.json({ ...paginateEvents(MOCK_AUDIT_EVENTS, page, perPage) });
  }),

  // super-admin export trigger
  http.post('*/api/v1/super-admin/audit-events/exports', () => {
    return HttpResponse.json(
      { data: { jobId: 'job-super-mock-001' } },
      { status: 202 },
    );
  }),

  // super-admin export status
  http.get('*/api/v1/super-admin/audit-events/exports/:jobId', ({ params }) => {
    return HttpResponse.json({
      data: {
        jobId: params.jobId,
        status: 'completed',
        signedUrl: 'https://storage.example.com/exports/super-audit-export.csv?token=mock',
        expiresAt: '2026-06-12T10:00:00.000Z',
        failureReason: null,
      },
    });
  }),
];
