'use client';

import { useCallback, useEffect, useState } from 'react';

const SILENCE_KEY = 'metanoia:notificationSilence';

/**
 * useNotificationSilence — manages the "silence notifications" toggle.
 * Persists to localStorage (SSR-safe). Syncs across browser tabs via
 * the `storage` event.
 */
export function useNotificationSilence() {
  const [silenced, setSilencedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SILENCE_KEY) === 'true';
  });

  useEffect(() => {
    // Cross-tab sync via storage event
    function handleStorage(e: StorageEvent) {
      if (e.key === SILENCE_KEY) {
        setSilencedState(e.newValue === 'true');
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setSilenced = useCallback((value: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SILENCE_KEY, String(value));
    }
    setSilencedState(value);
  }, []);

  return { silenced, setSilenced };
}
