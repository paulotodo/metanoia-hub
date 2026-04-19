export type RelativeMeeting =
  | { type: 'today' }
  | { type: 'tomorrow' }
  | { type: 'inDays'; days: number };

export function formatRelativeMeeting(
  startsAt: string,
  now: Date = new Date(),
): RelativeMeeting {
  const target = new Date(startsAt);
  const targetDay = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  const nowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const diffMs = targetDay - nowDay;
  const days = Math.round(diffMs / 86_400_000);

  if (days <= 0) return { type: 'today' };
  if (days === 1) return { type: 'tomorrow' };
  return { type: 'inDays', days };
}
