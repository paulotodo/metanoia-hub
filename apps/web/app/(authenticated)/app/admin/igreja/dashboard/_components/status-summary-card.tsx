interface StatusSummaryCardProps {
  label: string;
  count: number;
  total: number;
  variant: 'verde' | 'amarelo' | 'vermelho';
}

const variantStyles: Record<StatusSummaryCardProps['variant'], string> = {
  verde: 'border-green-200 bg-green-50 text-green-800',
  amarelo: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  vermelho: 'border-red-200 bg-red-50 text-red-800',
};

const dotStyles: Record<StatusSummaryCardProps['variant'], string> = {
  verde: 'bg-green-500',
  amarelo: 'bg-yellow-500',
  vermelho: 'bg-red-500',
};

export function StatusSummaryCard({
  label,
  count,
  total,
  variant,
}: StatusSummaryCardProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div
      className={`rounded-lg border p-4 ${variantStyles[variant]}`}
      role="status"
      aria-label={`${label}: ${count} de ${total} participantes`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block h-3 w-3 rounded-full ${dotStyles[variant]}`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold leading-none">{count}</p>
      <p className="mt-1 text-xs opacity-70">{pct}% do total</p>
    </div>
  );
}
