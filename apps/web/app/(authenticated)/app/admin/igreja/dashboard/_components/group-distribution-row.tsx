import type { RadarGroupSummary } from '@metanoia/types';

interface GroupDistributionRowProps {
  group: RadarGroupSummary;
}

export function GroupDistributionRow({ group }: GroupDistributionRowProps) {
  const { groupName, verde, amarelo, vermelho, total } = group;

  const greenPct = total > 0 ? (verde / total) * 100 : 0;
  const yellowPct = total > 0 ? (amarelo / total) * 100 : 0;
  const redPct = total > 0 ? (vermelho / total) * 100 : 0;

  return (
    <li className="rounded-lg border border-border bg-bg-primary p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{groupName}</span>
        <span className="text-xs text-text-secondary">{total} participantes</span>
      </div>

      {/* Progress bar */}
      <div
        className="flex h-3 overflow-hidden rounded-full"
        role="img"
        aria-label={`${groupName}: ${verde} regular, ${amarelo} atenção, ${vermelho} urgente`}
      >
        {verde > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${greenPct}%` }}
            title={`Regular: ${verde}`}
          />
        )}
        {amarelo > 0 && (
          <div
            className="bg-yellow-400"
            style={{ width: `${yellowPct}%` }}
            title={`Atenção: ${amarelo}`}
          />
        )}
        {vermelho > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${redPct}%` }}
            title={`Urgente: ${vermelho}`}
          />
        )}
        {total === 0 && (
          <div className="w-full bg-bg-secondary" />
        )}
      </div>

      <div className="mt-1 flex gap-4 text-xs text-text-secondary">
        <span>{verde} regular</span>
        <span>{amarelo} atenção</span>
        <span>{vermelho} urgente</span>
      </div>
    </li>
  );
}
