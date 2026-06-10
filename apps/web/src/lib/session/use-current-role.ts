'use client';

import { useEffect, useState } from 'react';

type PlatformRole = 'super_admin' | 'admin_tenant' | 'lider' | 'participante';

const ROLE_PRIORITY: PlatformRole[] = [
  'super_admin',
  'admin_tenant',
  'lider',
  'participante',
];

interface JwtPayload {
  realm_access?: { roles?: string[] };
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

/** Returns the highest-priority platform role from the access token, or null. */
export function useCurrentRole(): PlatformRole | null {
  const [role, setRole] = useState<PlatformRole | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = sessionStorage.getItem('accessToken');
    if (!token) return;
    const payload = decodeJwtPayload(token);
    const roles = payload?.realm_access?.roles ?? [];
    const found = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
    setRole(found);
  }, []);

  return role;
}
