'use client';

import { useEffect, useRef } from 'react';
import messages from '../../../../../messages/pt-BR.json';
import type { IntegrationHealthHistoryPoint } from '@metanoia/types';
import { useIntegrationHistory } from '../_hooks/use-integration-health';

interface IntegrationHistoryModalProps {
  integrationName: string;
  onClose: () => void;
  /** ref do card que abriu o modal (para retornar foco ao fechar — CHK074) */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * IntegrationHistoryModal — tabela de logs históricos da integração.
 *
 * Story 14-4 §FR-010.
 * Acessibilidade:
 *  - Fecha com Escape (CHK074)
 *  - Foco retorna ao card que abriu após fechar (CHK074)
 *  - Textos i18n PT-BR via pt-BR.json (CHK085)
 */
export function IntegrationHistoryModal({
  integrationName,
  onClose,
  triggerRef,
}: IntegrationHistoryModalProps) {
  const m = messages.health.integrations.modal;
  const modalRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = useIntegrationHistory(integrationName);

  // Fechar com Escape (CHK074)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        triggerRef?.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, triggerRef]);

  // Focar o modal ao abrir
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // Retornar foco ao trigger ao desmontar (CHK074)
  useEffect(() => {
    return () => {
      triggerRef?.current?.focus();
    };
  }, [triggerRef]);

  const STATUS_LABEL: Record<string, string> = {
    healthy: 'Saudável',
    degraded: 'Degradado',
    unhealthy: 'Indisponível',
  };

  const points: IntegrationHealthHistoryPoint[] = data?.data?.points ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Histórico de ${integrationName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
          triggerRef?.current?.focus();
        }
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">
            {integrationName} — Histórico de saúde (24h)
          </h2>
          <button
            type="button"
            aria-label="Fechar histórico"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-teal/30 rounded p-1"
            onClick={() => {
              onClose();
              triggerRef?.current?.focus();
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {isLoading && (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Carregando histórico...
            </p>
          )}

          {isError && (
            <p role="alert" className="text-sm text-red-600">
              Não foi possível carregar o histórico.
            </p>
          )}

          {!isLoading && !isError && points.length === 0 && (
            <p role="status" className="text-sm text-muted-foreground italic">
              {m.noHistory}
            </p>
          )}

          {!isLoading && !isError && points.length > 0 && (
            <table className="w-full text-sm" aria-label={`Histórico de saúde de ${integrationName}`}>
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground">{m.status}</th>
                  <th className="pb-2 font-medium text-muted-foreground">{m.latencyMs}</th>
                  <th className="pb-2 font-medium text-muted-foreground">{m.message}</th>
                  <th className="pb-2 font-medium text-muted-foreground">{m.checkedAt}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1.5">
                      <span className={
                        p.status === 'healthy' ? 'text-green-600 font-medium' :
                        p.status === 'degraded' ? 'text-yellow-600 font-medium' :
                        'text-red-600 font-medium'
                      }>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {p.latencyMs !== null ? `${p.latencyMs}ms` : '—'}
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {p.message ?? '—'}
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {new Date(p.checkedAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
