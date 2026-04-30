'use client';

import { useEffect, useState } from 'react';

interface JwtPayload {
  given_name?: string;
  name?: string;
  preferred_username?: string;
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

function extractFirstName(payload: JwtPayload | null): string | null {
  if (!payload) return null;
  const candidate =
    payload.given_name ?? payload.name ?? payload.preferred_username ?? null;
  if (!candidate) return null;
  const first = candidate.trim().split(/\s+/)[0];
  return first ?? null;
}

export function useCurrentFirstName(): string | null {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = sessionStorage.getItem('accessToken');
    if (!token) return;
    setFirstName(extractFirstName(decodeJwtPayload(token)));
  }, []);

  return firstName;
}
