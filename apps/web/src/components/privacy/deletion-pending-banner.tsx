'use client';

/**
 * DeletionPendingBanner — avisa o titular que a conta está em grace period.
 *
 * Renderizado no layout autenticado quando user.status === 'deletion_pending'.
 * AVS-02: status vem de useCurrentUser() (TanStack Query, GET /api/v1/users/me),
 * não de useAuth().
 *
 * Story 9-2 / LGPD Art. 18 VI.
 */

import { useCurrentUser } from '../../hooks/use-current-user';
import { usePrivacyDeletion } from '../../hooks/use-privacy-deletion';

// ---------------------------------------------------------------------------
// DeletionPendingBanner
// ---------------------------------------------------------------------------

interface DeletionPendingBannerProps {
  /** Active deletion requestId — required to enable cancel action. */
  requestId?: string;
}

export function DeletionPendingBanner({ requestId }: DeletionPendingBannerProps) {
  const { user } = useCurrentUser();

  const { cancelDeletion, isCancelPending } = usePrivacyDeletion(requestId);

  if (!user || user.status !== 'deletion_pending') {
    return null;
  }

  const handleCancel = () => {
    if (!requestId) return;
    cancelDeletion(requestId);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="deletion-pending-banner"
      className="w-full bg-amber-50 border-b border-amber-200 px-4 py-3"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <p className="text-sm font-medium text-amber-800">
          Exclusão de conta solicitada.{' '}
          <span className="font-normal text-amber-700">
            Sua conta será excluída em breve. Se mudou de ideia, cancele agora.
          </span>
        </p>
        {requestId && (
          <button
            type="button"
            data-testid="banner-cancel-deletion-button"
            onClick={handleCancel}
            disabled={isCancelPending}
            className="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelPending ? 'Cancelando…' : 'Cancelar exclusão'}
          </button>
        )}
      </div>
    </div>
  );
}
