'use client';

/**
 * DeletionSection — UI para solicitação / cancelamento de exclusão de conta.
 * Vocabulário pastoral PT-BR. Route: /app/consumo/perfil/privacidade
 *
 * Story 9-2 / LGPD Art. 18 VI.
 * AVS-02: usa usePrivacyDeletion (TanStack Query), não useAuth().
 */

import { useState } from 'react';
import { PRIVACY_DELETION_GRACE_DAYS, PRIVACY_DELETION_DEADLINE_DAYS } from '@metanoia/types';
import { usePrivacyDeletion } from '../../hooks/use-privacy-deletion';

// ---------------------------------------------------------------------------
// Helper: format ISO datetime to PT-BR locale date
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// DeletionSection
// ---------------------------------------------------------------------------

interface DeletionSectionProps {
  /** If an active deletion request already exists, pass its id for polling. */
  initialRequestId?: string;
}

export function DeletionSection({ initialRequestId }: DeletionSectionProps) {
  const [confirmed, setConfirmed] = useState(false);

  const {
    requestDeletion,
    cancelDeletion,
    requestId,
    deletionStatus,
    cancellableUntil,
    deletionDeadline,
    isRequestPending,
    isCancelPending,
    isDuplicateError,
    isLeaderBlocker,
    requestError,
    cancelError,
  } = usePrivacyDeletion(initialRequestId);

  const isActive = requestId !== null;
  // Consider active+pending if: status is pending/soft_deleted, OR we have a
  // requestId but status hasn't loaded yet (deletionStatus still null).
  const isPendingStatus =
    deletionStatus?.status === 'pending' ||
    deletionStatus?.status === 'soft_deleted' ||
    (isActive && deletionStatus === null);
  const isCancelled = deletionStatus?.status === 'cancelled';
  const isCompleted = deletionStatus?.status === 'hard_deleted';
  const isFailed = deletionStatus?.status === 'failed';

  const handleRequest = () => {
    if (!confirmed) return;
    requestDeletion();
  };

  const handleCancel = () => {
    if (!requestId) return;
    cancelDeletion(requestId);
  };

  return (
    <section
      aria-labelledby="deletion-section-title"
      className="mt-10 rounded-lg border border-red-200 bg-white p-6"
    >
      <h2 id="deletion-section-title" className="text-lg font-semibold text-gray-900">
        Solicitar exclusão da conta
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Ao solicitar a exclusão, seus dados serão removidos permanentemente em{' '}
        <strong>{PRIVACY_DELETION_DEADLINE_DAYS} dias</strong>. Você pode cancelar dentro
        do período de <strong>{PRIVACY_DELETION_GRACE_DAYS} dias</strong>.
      </p>

      {/* Already cancelled — allow new request */}
      {isCancelled && (
        <p
          role="status"
          aria-live="polite"
          data-testid="deletion-cancelled"
          className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700"
        >
          Solicitação cancelada com sucesso.
        </p>
      )}

      {/* Completed */}
      {isCompleted && (
        <p
          role="status"
          aria-live="polite"
          data-testid="deletion-completed"
          className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700"
        >
          Sua conta foi excluída.
        </p>
      )}

      {/* Failed */}
      {isFailed && (
        <p
          role="alert"
          data-testid="deletion-failed"
          className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          Falha na exclusão. Entre em contato com o suporte.
        </p>
      )}

      {/* Active pending request — show status + cancel button */}
      {isActive && isPendingStatus && (
        <div
          role="status"
          aria-live="polite"
          data-testid="deletion-pending-status"
          className="mt-4 rounded-md bg-amber-50 p-4"
        >
          <p className="text-sm font-medium text-amber-800">Exclusão solicitada</p>
          {cancellableUntil && (
            <p className="mt-1 text-sm text-amber-700">
              Cancelável até:{' '}
              <time dateTime={cancellableUntil}>{formatDate(cancellableUntil)}</time>
            </p>
          )}
          {deletionDeadline && (
            <p className="mt-1 text-sm text-amber-700">
              Exclusão definitiva prevista para:{' '}
              <time dateTime={deletionDeadline}>{formatDate(deletionDeadline)}</time>
            </p>
          )}
          <button
            type="button"
            data-testid="cancel-deletion-button"
            onClick={handleCancel}
            disabled={isCancelPending}
            className="mt-3 rounded-md border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelPending ? 'Cancelando…' : 'Cancelar solicitação de exclusão'}
          </button>
          {cancelError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              Não foi possível cancelar a solicitação. Tente novamente.
            </p>
          )}
        </div>
      )}

      {/* No active request — show request form */}
      {!isActive && !isCancelled && !isCompleted && (
        <div className="mt-4">
          {/* Confirmation checkbox */}
          <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              data-testid="deletion-confirm-checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600"
              aria-describedby="deletion-confirm-description"
            />
            <span id="deletion-confirm-description">
              Para confirmar, entendo que esta ação irá remover meus dados desta comunidade.
            </span>
          </label>

          <button
            type="button"
            data-testid="request-deletion-button"
            onClick={handleRequest}
            disabled={!confirmed || isRequestPending}
            className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRequestPending ? 'Processando…' : 'Solicitar exclusão da minha conta'}
          </button>

          {/* Duplicate — already pending */}
          {isDuplicateError && (
            <p
              role="alert"
              data-testid="deletion-duplicate-warning"
              className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700"
            >
              Já existe uma solicitação de exclusão ativa.
            </p>
          )}

          {/* Leader blocker — 422 */}
          {isLeaderBlocker && (
            <p
              role="alert"
              data-testid="deletion-leader-blocker"
              className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700"
            >
              Você lidera grupos ativos. Transfira a liderança antes de solicitar a exclusão.
            </p>
          )}

          {/* Generic error */}
          {requestError && !isDuplicateError && !isLeaderBlocker && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              Não foi possível processar sua solicitação. Tente novamente.
            </p>
          )}
        </div>
      )}

      {/* Success confirmation after request */}
      {isActive && !isPendingStatus && !isCancelled && !isCompleted && !isFailed && (
        <p
          role="status"
          aria-live="polite"
          data-testid="deletion-success"
          className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700"
        >
          Solicitação de exclusão registrada. Você pode cancelar até a data indicada.
        </p>
      )}
    </section>
  );
}
