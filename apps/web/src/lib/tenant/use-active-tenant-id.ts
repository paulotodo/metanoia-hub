'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'metanoia:activeTenantId';

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function useActiveTenantId() {
  const [activeTenantId, setState] = useState<string | null>(null);

  useEffect(() => {
    setState(readStored());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setState(event.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setActiveTenantId = (id: string | null) => {
    if (typeof window !== 'undefined') {
      if (id === null) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, id);
      }
    }
    setState(id);
  };

  return { activeTenantId, setActiveTenantId };
}
