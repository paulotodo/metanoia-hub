import type { PastoralStatus } from '@metanoia/types';

const DOT_CLASSES: Record<PastoralStatus, string> = {
  healthy: 'bg-emerald-500',
  attention: 'bg-amber-500',
  call: 'bg-red-500',
  'no-signal': 'bg-slate-400',
};

export const STATUS_BORDER_CLASSES: Record<PastoralStatus, string> = {
  healthy: 'border-l-emerald-500',
  attention: 'border-l-amber-500',
  call: 'border-l-red-500',
  'no-signal': 'border-l-slate-400',
};

interface StatusIndicatorProps {
  status: PastoralStatus;
  phrase: string;
}

export function StatusIndicator({ status, phrase }: StatusIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_CLASSES[status]}`}
      />
      <span className="text-body-sm">{phrase}</span>
    </span>
  );
}
