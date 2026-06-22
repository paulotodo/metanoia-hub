import type { PresenceDot } from '@metanoia/types';

/**
 * Maps presence-dot values to the API contract (PresenceDotSchema:
 * 'present' | 'absent' | 'no-meeting').
 *
 * Demo/seed data (demo-seed.ts) stores legacy compact codes
 * ('y' = present, 'n' = absent, 'p' = partial). Partial attendance has no
 * representation in the contract, so it maps to 'present'. Values already in
 * the canonical form pass through unchanged. Unknown values are dropped so a
 * single bad row can never break the radar response (frontend parse).
 */
const PRESENCE_DOT_MAP: Record<string, PresenceDot> = {
  y: 'present',
  n: 'absent',
  p: 'present',
  present: 'present',
  absent: 'absent',
  'no-meeting': 'no-meeting',
};

/** Normalize a raw presence-dots array (from the DB) to PresenceDot[]. */
export function normalizePresenceDots(raw: unknown): PresenceDot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => PRESENCE_DOT_MAP[String(value)])
    .filter((value): value is PresenceDot => value !== undefined);
}
