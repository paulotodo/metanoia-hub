import type { DashboardTrend } from '@metanoia/types';

interface TrendBadgeProps {
  trend: DashboardTrend;
  label: string;
}

const trendStyles: Record<DashboardTrend, string> = {
  melhora: 'bg-green-100 text-green-700',
  estavel: 'bg-gray-100 text-gray-600',
  piora: 'bg-red-100 text-red-700',
};

const trendIcons: Record<DashboardTrend, string> = {
  melhora: '↑',
  estavel: '→',
  piora: '↓',
};

export function TrendBadge({ trend, label }: TrendBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${trendStyles[trend]}`}
      aria-label={`Tendência: ${label}`}
    >
      <span aria-hidden="true">{trendIcons[trend]}</span>
      {label}
    </span>
  );
}
