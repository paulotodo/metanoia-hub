'use client';

/* eslint-disable @metanoia/no-surveillance-terms --
 * The `focus_monitoring` ConsentType label ("Monitoramento de Foco") is the
 * canonical LGPD consent-type name, already committed as the source-of-truth
 * key `privacy.consentType_focus_monitoring` in messages/pt-BR.json. It is
 * legally-precise consent vocabulary for the privacy screen, not general
 * pastoral UI copy. No new surveillance wording is introduced here. */

import { useState } from 'react';
import type { ConsentHistoryItem, ConsentType } from '@metanoia/types';
import { useConsentHistory } from '@/hooks/use-consent-history';
import { useWithdrawConsent } from '@/hooks/use-withdraw-consent';
import { usePrivacyExport } from '@/hooks/use-privacy-export';
import { DeletionSection } from '@/components/privacy';

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: 'accepted' | 'withdrawn' | 'pending';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const labels: Record<string, string> = {
    accepted: 'Aceito',
    withdrawn: 'Revogado',
    pending: 'Pendente',
  };
  const colors: Record<string, string> = {
    accepted: 'bg-green-100 text-green-800',
    withdrawn: 'bg-red-100 text-red-800',
    pending: 'bg-gray-100 text-gray-600',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? ''}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Consent type display names
// ---------------------------------------------------------------------------

const DISPLAY_NAMES: Record<ConsentType, string> = {
  terms_of_service: 'Termos de Uso',
  privacy_policy: 'Política de Privacidade',
  focus_monitoring: 'Monitoramento de Foco',
};

// ---------------------------------------------------------------------------
// ConsentItem row
// ---------------------------------------------------------------------------

interface ConsentItemProps {
  item: ConsentHistoryItem;
  onWithdraw: (consentType: ConsentType) => void;
  isPending: boolean;
}

function ConsentItem({ item, onWithdraw, isPending }: ConsentItemProps) {
  const label = DISPLAY_NAMES[item.consentType];
  const ariaLabel = item.isMandatory
    ? `${label} — consentimento obrigatório, não pode ser revogado`
    : `Revogar consentimento para ${label}`;

  return (
    <li className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{label}</span>
          <StatusBadge status={item.status} />
        </div>
        {item.acceptedAt && (
          <p className="mt-1 text-sm text-gray-500">
            Aceito em:{' '}
            {new Date(item.acceptedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
        {item.withdrawnAt && (
          <p className="mt-1 text-sm text-gray-500">
            Revogado em:{' '}
            {new Date(item.withdrawnAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
      <div>
        {item.isMandatory ? (
          <button
            type="button"
            disabled
            aria-label={ariaLabel}
            aria-describedby={`mandatory-tooltip-${item.consentType}`}
            className="cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400"
            title="Este consentimento é obrigatório para uso da plataforma e não pode ser revogado."
          >
            Obrigatório
          </button>
        ) : (
          <button
            type="button"
            aria-label={ariaLabel}
            disabled={item.status === 'withdrawn' || isPending}
            onClick={() => onWithdraw(item.consentType)}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Aguarde…' : 'Revogar'}
          </button>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ExportSection — "Meus dados" section with format selector + status
// ---------------------------------------------------------------------------

function ExportSection() {
  const [format, setFormat] = useState<'json' | 'pdf'>('json');
  const { requestExport, status, signedUrl, isPolling, isDuplicateError, error } =
    usePrivacyExport();

  const handleExport = () => {
    requestExport(format);
  };

  return (
    <section
      aria-labelledby="export-section-title"
      className="mt-10 rounded-lg border border-gray-200 bg-white p-6"
    >
      <h2 id="export-section-title" className="text-lg font-semibold text-gray-900">
        Meus dados
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Solicite uma cópia de todos os seus dados pessoais armazenados na plataforma.
        O arquivo ficará disponível por 48 horas.
      </p>

      {/* Format selector */}
      <fieldset className="mt-4">
        <legend className="sr-only">Formato do arquivo</legend>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="export-format"
              value="json"
              checked={format === 'json'}
              onChange={() => setFormat('json')}
              className="text-indigo-600"
            />
            Formato JSON
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="export-format"
              value="pdf"
              checked={format === 'pdf'}
              onChange={() => setFormat('pdf')}
              className="text-indigo-600"
            />
            Formato PDF
          </label>
        </div>
      </fieldset>

      {/* Export button */}
      <button
        type="button"
        data-testid="export-button"
        onClick={handleExport}
        disabled={isPolling}
        className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPolling ? 'Preparando…' : 'Exportar meus dados'}
      </button>

      {/* Duplicate warning — 409 */}
      {isDuplicateError && (
        <p
          role="alert"
          data-testid="duplicate-warning"
          className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700"
        >
          Já existe uma exportação em andamento. Aguarde a conclusão antes de solicitar uma nova.
        </p>
      )}

      {/* Generic error */}
      {error && !isDuplicateError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          Não foi possível processar sua solicitação. Tente novamente.
        </p>
      )}

      {/* In-progress status */}
      {(status === 'accepted' || status === 'processing') && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-2 text-sm text-gray-600"
        >
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"
            aria-hidden="true"
          />
          {status === 'accepted' ? 'Solicitação recebida' : 'Preparando seu arquivo…'}
          <span className="text-xs text-gray-400">(tempo estimado: até 24h)</span>
        </div>
      )}

      {/* Completed — toast-like inline alert + download link */}
      {status === 'completed' && signedUrl && (
        <div
          role="status"
          aria-live="polite"
          data-testid="export-completed"
          className="mt-4 rounded-md bg-green-50 p-4"
        >
          <p className="text-sm font-medium text-green-800">
            Seu arquivo está pronto! Clique para baixar.
          </p>
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center text-sm font-medium text-indigo-600 underline hover:text-indigo-800"
            data-testid="download-link"
          >
            Baixar meu arquivo
          </a>
        </div>
      )}

      {/* Failed */}
      {status === 'failed' && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Não foi possível gerar o arquivo. Tente novamente.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Privacidade & Consentimento — authenticated CSR page.
 * Route: /app/consumo/perfil/privacidade
 */
export default function PrivacidadeConsentimentoPage() {
  const { data, isLoading, isError } = useConsentHistory();
  const withdrawMutation = useWithdrawConsent();

  const handleWithdraw = (consentType: ConsentType) => {
    withdrawMutation.mutate({ consentType });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Privacidade &amp; Consentimento
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Gerencie seus consentimentos e veja como usamos seus dados.
      </p>

      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 space-y-3"
          data-testid="consent-loading"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 motion-safe:animate-pulse rounded-lg bg-gray-100"
              aria-hidden="true"
            />
          ))}
          <span className="sr-only">Carregando consentimentos…</span>
        </div>
      )}

      {isError && !isLoading && (
        <p
          role="alert"
          className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700"
        >
          Erro ao carregar consentimentos. Tente novamente.
        </p>
      )}

      {withdrawMutation.isError && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700"
        >
          Erro ao revogar consentimento. Tente novamente.
        </p>
      )}

      {data && (
        <ul
          aria-label="Lista de consentimentos"
          className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white px-4"
        >
          {data.data.map((item) => (
            <ConsentItem
              key={item.consentType}
              item={item}
              onWithdraw={handleWithdraw}
              isPending={withdrawMutation.isPending}
            />
          ))}
        </ul>
      )}

      {/* Meus dados — export personal data */}
      <ExportSection />

      {/* Exclusão de conta — LGPD Art. 18 VI */}
      <DeletionSection />
    </main>
  );
}
