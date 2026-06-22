'use client';

import { useState, useRef, useCallback } from 'react';
import messages from '../../../../../messages/pt-BR.json';
import { useIntegrationHealth, useIntegrationHistory } from '../_hooks/use-integration-health';
import { IntegrationHealthCard } from './integration-health-card';
import { IntegrationHistoryModal } from './integration-history-modal';

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutos

/**
 * HealthDashboard — container principal do painel de saúde de integrações.
 *
 * Story 14-4 §FR-010.
 * Acessibilidade:
 *  - aria-live="polite" no container de status (CHK071/CHK072)
 *  - role="status" no indicador de refresh (CHK071)
 *  - Stale banner quando dados > 2min (CHK067)
 *  - Skeleton cards durante loading (CHK066)
 *  - Alerta crítico quando TODAS unhealthy (CHK087)
 *  - Erro persistente com botão retry (CHK069)
 */
export function HealthDashboard() {
  const m = messages.health.integrations;
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const {
    data,
    isLoading,
    isError,
    dataUpdatedAt,
    refetch,
  } = useIntegrationHealth();

  // History hook para integração selecionada
  const { data: historyData } = useIntegrationHistory(selectedIntegration ?? '', 24);

  const handleOpenHistory = useCallback((name: string) => {
    setSelectedIntegration(name);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedIntegration(null);
  }, []);

  const integrations = data?.data?.integrations ?? [];
  const isStale = dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > STALE_THRESHOLD_MS;
  const allUnhealthy =
    integrations.length > 0 && integrations.every((i) => i.status === 'unhealthy');

  // ---- Loading skeleton ---------------------------------------------------
  if (isLoading) {
    return (
      <div
        aria-live="polite"
        aria-label="Carregando dados de saúde das integrações"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 h-24 animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  // ---- Erro persistente ---------------------------------------------------
  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">{m.fetchError}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 text-sm underline hover:no-underline focus-visible:ring-2 focus-visible:ring-brand-teal/30 rounded"
        >
          {m.retry}
        </button>
      </div>
    );
  }

  // Triggerref para modal
  const selectedTriggerRef = {
    current: selectedIntegration ? cardRefs.current.get(selectedIntegration) ?? null : null,
  };

  return (
    <div aria-live="polite">
      {/* Alerta crítico: todas as integrações unhealthy (CHK087) */}
      {allUnhealthy && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-400 bg-red-100 p-4 text-red-800 font-semibold"
        >
          {m.allUnhealthy}
        </div>
      )}

      {/* Stale banner: dados > 2min (CHK067) */}
      {isStale && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-800"
        >
          {m.staleWarning}
        </div>
      )}

      {/* Indicador de refresh (CHK071) */}
      {dataUpdatedAt > 0 && (
        <p role="status" className="text-xs text-muted-foreground mb-4">
          {m.lastUpdated.replace('{seconds}', String(Math.floor((Date.now() - dataUpdatedAt) / 1000)))}
        </p>
      )}

      {/* Grid de cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {integrations.map((item) => {
          const history = historyData?.data?.points ?? [];
          return (
            <div
              key={item.name}
              ref={(el) => {
                if (el) cardRefs.current.set(item.name, el);
              }}
            >
              <IntegrationHealthCard
                item={item}
                history={selectedIntegration === item.name ? history : []}
                onOpenHistory={handleOpenHistory}
              />
            </div>
          );
        })}
      </div>

      {/* Modal de histórico */}
      {selectedIntegration && (
        <IntegrationHistoryModal
          integrationName={selectedIntegration}
          onClose={handleCloseModal}
          triggerRef={selectedTriggerRef as React.RefObject<HTMLElement | null>}
        />
      )}
    </div>
  );
}
