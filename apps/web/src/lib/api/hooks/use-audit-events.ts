import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AuditEventListResponseSchema,
  AuditExportJobStatusSchema,
  AUDIT_EVENTS_PAGE_SIZE,
  type AuditAction,
  type AuditEventListResponse,
  type AuditExportJobStatus,
  type AuditEventsQuery,
  type AuditSeverity,
} from '@metanoia/types';
import { envelopeClient } from '../envelope';

// ─── Query key factory ────────────────────────────────────────────────────────

export const auditEventsKeys = {
  all: ['audit-events'] as const,
  list: (args: UseAuditEventsArgs) =>
    [...auditEventsKeys.all, 'list', args] as const,
  superList: (args: UseSuperAdminAuditEventsArgs) =>
    [...auditEventsKeys.all, 'super', 'list', args] as const,
  exportStatus: (jobId: string) =>
    [...auditEventsKeys.all, 'export', jobId] as const,
};

// ─── Shared filter args ───────────────────────────────────────────────────────

export interface UseAuditEventsArgs {
  page?: number;
  perPage?: number;
  action?: AuditAction | '';
  severity?: AuditSeverity | '';
  userId?: string;
  resource?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface UseSuperAdminAuditEventsArgs extends UseAuditEventsArgs {
  tenantId?: string;
}

// ─── Query string builder ─────────────────────────────────────────────────────

function buildAuditQueryString(args: UseAuditEventsArgs): string {
  const params = new URLSearchParams();
  params.set('page', String(args.page ?? 1));
  params.set('perPage', String(args.perPage ?? AUDIT_EVENTS_PAGE_SIZE));
  if (args.action) params.set('action', args.action);
  if (args.severity) params.set('severity', args.severity);
  if (args.userId) params.set('userId', args.userId);
  if (args.resource) params.set('resource', args.resource);
  if (args.q) params.set('q', args.q);
  if (args.dateFrom) params.set('dateFrom', args.dateFrom);
  if (args.dateTo) params.set('dateTo', args.dateTo);
  return params.toString();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Hook for admin_tenant: GET /api/v1/audit-events (tenant-scoped via RLS).
 * Auto-refreshes every 30 seconds (FR-009, dec-022).
 */
export function useAuditEvents(args: UseAuditEventsArgs = {}) {
  return useQuery<AuditEventListResponse>({
    queryKey: auditEventsKeys.list(args),
    queryFn: () =>
      envelopeClient.get(
        `/audit-events?${buildAuditQueryString(args)}`,
        AuditEventListResponseSchema,
      ),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Hook for super_admin: GET /api/v1/super-admin/audit-events (cross-tenant).
 * Requires tenantId query param to scope the query.
 * Auto-refreshes every 30 seconds (FR-009, API-012).
 */
export function useSuperAdminAuditEvents(
  args: UseSuperAdminAuditEventsArgs = {},
) {
  const qs = buildAuditQueryString(args);
  const tenantParam = args.tenantId ? `&tenantId=${args.tenantId}` : '';
  return useQuery<AuditEventListResponse>({
    queryKey: auditEventsKeys.superList(args),
    queryFn: () =>
      envelopeClient.get(
        `/super-admin/audit-events?${qs}${tenantParam}`,
        AuditEventListResponseSchema,
      ),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ─── Export trigger (admin_tenant) ────────────────────────────────────────────

export interface TriggerAuditExportInput {
  query: Omit<AuditEventsQuery, 'page' | 'perPage'>;
}

export interface TriggerAuditExportResponse {
  jobId: string;
}

/**
 * Trigger async CSV export for admin_tenant.
 * Returns 202 with jobId; poll via useAuditExportStatus.
 */
export function useTriggerAuditExport() {
  return useMutation<TriggerAuditExportResponse, Error, TriggerAuditExportInput>(
    {
      mutationFn: (input) =>
        envelopeClient.post(
          '/audit-events/exports',
          input.query,
          // Inline schema: server returns { jobId }
          {
            parse: (data: unknown) => {
              const d = data as { data: { jobId: string } };
              return { jobId: d.data.jobId };
            },
          },
        ),
    },
  );
}

/**
 * Trigger async CSV export for super_admin (cross-tenant).
 */
export function useTriggerSuperAdminAuditExport() {
  return useMutation<TriggerAuditExportResponse, Error, TriggerAuditExportInput>(
    {
      mutationFn: (input) =>
        envelopeClient.post(
          '/super-admin/audit-events/exports',
          input.query,
          {
            parse: (data: unknown) => {
              const d = data as { data: { jobId: string } };
              return { jobId: d.data.jobId };
            },
          },
        ),
    },
  );
}

// ─── Export status polling ────────────────────────────────────────────────────

/**
 * Poll export job status.
 * Stops refetching when status is completed or failed.
 */
export function useAuditExportStatus(
  jobId: string | null,
  superAdmin = false,
) {
  return useQuery<AuditExportJobStatus>({
    queryKey: auditEventsKeys.exportStatus(jobId ?? ''),
    queryFn: () => {
      const base = superAdmin
        ? '/super-admin/audit-events/exports'
        : '/audit-events/exports';
      return envelopeClient.get(
        `${base}/${jobId ?? ''}`,
        AuditExportJobStatusSchema,
      );
    },
    enabled: jobId !== null && jobId.length > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 2000;
    },
    staleTime: 0,
  });
}
