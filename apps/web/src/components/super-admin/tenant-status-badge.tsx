import type { TenantStatus } from '@metanoia/types';
import messages from '../../../messages/pt-BR.json';

const t = messages.superAdmin.tenants.status;

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: t.active,
  suspended: t.suspended,
  provisioning: t.provisioning,
  provisioning_failed: t.failed,
};

const STATUS_VISUALS: Record<
  TenantStatus,
  { dot: string; text: string; bg: string }
> = {
  active: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  suspended: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
  },
  provisioning_failed: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  provisioning: {
    dot: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
  },
};

interface TenantStatusBadgeProps {
  status: TenantStatus;
  className?: string;
}

export function TenantStatusBadge({
  status,
  className = '',
}: TenantStatusBadgeProps) {
  const visual = STATUS_VISUALS[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      data-testid={`tenant-status-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${visual.bg} ${visual.text} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${visual.dot}`}
      />
      {label}
    </span>
  );
}
