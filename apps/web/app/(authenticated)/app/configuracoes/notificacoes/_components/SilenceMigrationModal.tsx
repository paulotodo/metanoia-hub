'use client';

/**
 * SilenceMigrationModal — Story 16-1 (FR78)
 * Appears on first visit when localStorage['metanoia:notificationSilence'] is set.
 * Allows user to either "keep silenced" (PATCH all inApp=false) or "configure by type".
 */
import { useState } from 'react';
import messages from '@/../messages/pt-BR.json';
import {
  useUpdateNotificationPreferences,
} from '@/hooks/use-notification-preferences';
import type { UpdateNotificationPreferences } from '@metanoia/types';

const t = messages.notificationPreferences;

const SILENCE_KEY = 'metanoia:notificationSilence';
const MIGRATION_SEEN_KEY = 'pref:migrationSeen';

interface SilenceMigrationModalProps {
  onClose: () => void;
}

export function SilenceMigrationModal({ onClose }: SilenceMigrationModalProps) {
  const updatePrefs = useUpdateNotificationPreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleKeepSilenced() {
    setIsSubmitting(true);
    const allDisabled: UpdateNotificationPreferences = {
      pastoral_alert: { inApp: false },
      group_message: { inApp: false },
      content_update: { inApp: false },
      meeting_reminder: { inApp: false },
      system: { inApp: false },
      export_ready: { inApp: false },
      content_new: { inApp: false },
    };
    try {
      await updatePrefs.mutateAsync(allDisabled);
      localStorage.removeItem(SILENCE_KEY);
      sessionStorage.setItem(MIGRATION_SEEN_KEY, 'true');
      onClose();
    } catch {
      // Toast handled by parent
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleConfigureByType() {
    localStorage.removeItem(SILENCE_KEY);
    sessionStorage.setItem(MIGRATION_SEEN_KEY, 'true');
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-modal-title"
      data-testid="migration-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2
          id="migration-modal-title"
          className="text-lg font-semibold text-gray-900 mb-3"
        >
          {t.migrationModal.title}
        </h2>
        <p className="text-sm text-gray-600 mb-6">{t.migrationModal.body}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-testid="btn-configurar-por-tipo"
            onClick={handleConfigureByType}
            disabled={isSubmitting}
            className={[
              'rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700',
              'hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {t.migrationModal.configureByType}
          </button>
          <button
            type="button"
            data-testid="btn-manter-silenciado"
            onClick={() => void handleKeepSilenced()}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className={[
              'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white',
              'hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {isSubmitting ? '…' : t.migrationModal.keepSilenced}
          </button>
        </div>
      </div>
    </div>
  );
}
