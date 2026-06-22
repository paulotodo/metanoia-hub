'use client';

import messages from '../../../../../messages/pt-BR.json';
import type { IntegrationHealthItem, IntegrationHealthHistoryPoint } from '@metanoia/types';
import { LatencySparkline } from './latency-sparkline';

interface IntegrationHealthCardProps {
  item: IntegrationHealthItem;
  history?: IntegrationHealthHistoryPoint[];
  onOpenHistory: (name: string) => void;
}

/**
 * Mapeamento de status para classes Tailwind.
 * Usa cor + TEXTO (WCAG 1.4.1 — CHK062b: não usar apenas cor para transmitir info).
 */
const STATUS_BADGE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  healthy: {
    bg: 'bg-green-500',
    text: 'text-white',
    label: messages.health.integrations.status.healthy,
  },
  degraded: {
    bg: 'bg-yellow-500',
    text: 'text-white',
    label: messages.health.integrations.status.degraded,
  },
  unhealthy: {
    bg: 'bg-red-500',
    text: 'text-white',
    label: messages.health.integrations.status.unhealthy,
  },
};

/**
 * IntegrationHealthCard — card por integração com badge, latência e sparkline.
 *
 * Story 14-4 §FR-010.
 * Acessibilidade:
 *  - Badge combina cor + texto PT-BR (CHK062b — WCAG 1.4.1)
 *  - Card focável com tabIndex={0}, acionável com Enter/Space (CHK074)
 *  - aria-label descritivo com nome e status (CHK074)
 *  - focus-ring ring-brand-teal/30 (design system)
 */
export function IntegrationHealthCard({
  item,
  history = [],
  onOpenHistory,
}: IntegrationHealthCardProps) {
  const m = messages.health.integrations;
  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE['unhealthy'];
  const lastCheckedDate = new Date(item.lastChecked);
  const nowMs = Date.now();
  const ageSeconds = Math.floor((nowMs - lastCheckedDate.getTime()) / 1_000);

  function handleActivate() {
    onOpenHistory(item.name);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.name}: ${badge.label}. ${item.latencyMs !== null ? `${item.latencyMs}ms.` : ''} ${m.lastUpdated.replace('{seconds}', String(ageSeconds))}`}
      className={[
        'rounded-lg border border-border bg-card p-4 cursor-pointer',
        'transition-shadow motion-safe:transition-all',
        'hover:shadow-md',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 focus-visible:ring-offset-2',
      ].join(' ')}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
    >
      {/* Header: nome + badge */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-foreground">{item.name}</h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
          aria-hidden="true"
        >
          {badge.label}
        </span>
      </div>

      {/* Latência */}
      {item.latencyMs !== null && (
        <p className="text-xs text-muted-foreground mb-2">
          {item.latencyMs}ms
        </p>
      )}

      {/* Sparkline */}
      {history.length > 0 && (
        <div className="mb-2">
          <LatencySparkline
            data={history}
            integrationName={item.name}
            width={120}
            height={36}
          />
        </div>
      )}

      {/* Verificado há X min */}
      <p className="text-xs text-muted-foreground">
        {m.lastUpdated.replace('{seconds}', String(ageSeconds))}
      </p>
    </div>
  );
}
