/**
 * formatRelativeTime — formats a date as a PT-BR relative time string.
 * Uses Intl.RelativeTimeFormat('pt-BR') — zero external dependencies.
 *
 * Examples:
 *   - 3 minutes ago → "há 3 min"
 *   - 2 hours ago   → "há 2 horas"
 *   - yesterday     → "ontem"
 *   - 3 days ago    → "há 3 dias"
 */

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTime(dateStr: string, now = new Date()): string {
  const date = new Date(dateStr);
  const diffMs = date.getTime() - now.getTime(); // negative = past

  const absDiff = Math.abs(diffMs);

  if (absDiff < HOUR_MS) {
    const mins = Math.round(diffMs / MINUTE_MS);
    return rtf.format(mins, 'minute');
  }

  if (absDiff < DAY_MS) {
    const hours = Math.round(diffMs / HOUR_MS);
    return rtf.format(hours, 'hour');
  }

  const days = Math.round(diffMs / DAY_MS);
  return rtf.format(days, 'day');
}
