'use client';

/**
 * Notification Preferences Page — Story 16-1 (FR78)
 *
 * URL: /app/configuracoes/notificacoes
 *
 * - 7 types × 2 channels with optimistic update
 * - Líder: pastoral_alert.inApp locked (disabled + tooltip)
 * - Migration: detects localStorage['metanoia:notificationSilence'] → banner + modal
 * - Error state: message + retry button
 */
import { useEffect, useState } from 'react';
import type { NotificationType } from '@metanoia/types';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notification-preferences';
import { useCurrentRole } from '@/lib/session/use-current-role';
import { NotificationTypeRow } from './_components/NotificationTypeRow';
import { SilenceMigrationModal } from './_components/SilenceMigrationModal';
import messages from '@/../messages/pt-BR.json';

const t = messages.notificationPreferences;

const SILENCE_KEY = 'metanoia:notificationSilence';
const MIGRATION_SEEN_KEY = 'pref:migrationSeen';

// Pastoral display order
const TYPE_ORDER: NotificationType[] = [
  'pastoral_alert',
  'meeting_reminder',
  'content_new',
  'content_update',
  'export_ready',
  'group_message',
  'system',
];

export default function NotificationPreferencesPage() {
  const { data: prefs, isLoading, isError, refetch } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const role = useCurrentRole();
  const isLeader = role === 'lider';

  const [silenced, setSilenced] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasSilence = localStorage.getItem(SILENCE_KEY) !== null;
    setSilenced(hasSilence);

    if (hasSilence && !sessionStorage.getItem(MIGRATION_SEEN_KEY)) {
      setShowModal(true);
    }
  }, []);

  function handleToggle(
    type: NotificationType,
    channel: 'inApp' | 'email',
    value: boolean,
  ) {
    setErrorMsg(null);
    const channelKey = channel === 'inApp' ? 'inApp' : 'email';
    void updatePrefs
      .mutateAsync({ [type]: { [channelKey]: value } })
      .catch(() => {
        setErrorMsg(t.errors.updateFailed);
      });
  }

  const isMutating = updatePrefs.isPending;

  return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      {/* Silence banner */}
      {silenced && (
        <div
          data-testid="silence-banner"
          role="alert"
          className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800"
        >
          {t.silenceBanner.message}
        </div>
      )}

      <h1 className="mb-1 text-2xl font-semibold text-gray-900">
        {t.pageTitle}
      </h1>
      <p className="mb-6 text-sm text-gray-500">{t.pageDescription}</p>

      {/* Loading skeleton */}
      {isLoading && (
        <div aria-busy="true" aria-label={t.loading} className="space-y-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4">
              <div className="space-y-2">
                <div className="h-4 w-48 motion-safe:animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-64 motion-safe:animate-pulse rounded bg-gray-100" />
              </div>
              <div className="flex gap-4">
                <div className="h-6 w-11 motion-safe:animate-pulse rounded-full bg-gray-200" />
                <div className="h-6 w-11 motion-safe:animate-pulse rounded-full bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700 mb-3">{t.errors.fetchFailed}</p>
          <button
            type="button"
            data-testid="pref-error-retry"
            onClick={() => void refetch()}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Error toast for update failures */}
      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {errorMsg}
        </div>
      )}

      {/* Preference rows */}
      {!isLoading && !isError && prefs && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 divide-y divide-gray-100">
          {TYPE_ORDER.map((type) => {
            const typePrefs = prefs[type];
            const typeMessages = t.types[type as keyof typeof t.types];
            return (
              <NotificationTypeRow
                key={type}
                type={type}
                label={typeMessages?.label ?? type}
                description={typeMessages?.description ?? ''}
                inApp={silenced ? false : typePrefs.inApp}
                email={typePrefs.email}
                isLeader={isLeader}
                onToggle={handleToggle}
                isMutating={isMutating || silenced}
                inAppChannelLabel={t.channels.inApp}
                emailChannelLabel={t.channels.email}
                leaderTooltip={t.tooltip.leaderPastoralLock}
              />
            );
          })}
        </div>
      )}

      {/* Migration modal */}
      {showModal && (
        <SilenceMigrationModal
          onClose={() => {
            setShowModal(false);
            setSilenced(false);
          }}
        />
      )}
    </div>
  );
}
