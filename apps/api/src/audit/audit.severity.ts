/**
 * audit.severity.ts — deterministic action+resource → severity mapping.
 *
 * dec-023 (REQ-006):
 *  - delete | config_change → critical
 *  - auth_failure → critical (security event)
 *  - update + resource in AUDIT_WARNING_RESOURCES → warning
 *  - all others → info
 */
import { AUDIT_WARNING_RESOURCES, type AuditAction, type AuditSeverity } from '@metanoia/types';

export function getAuditSeverity(
  action: AuditAction,
  resource: string,
): AuditSeverity {
  if (action === 'delete' || action === 'config_change' || action === 'auth_failure') {
    return 'critical';
  }

  if (
    action === 'update' &&
    (AUDIT_WARNING_RESOURCES as readonly string[]).includes(resource)
  ) {
    return 'warning';
  }

  return 'info';
}
