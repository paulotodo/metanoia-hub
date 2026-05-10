/**
 * Unique tag for a single E2E execution. Used to namespace artifacts (group
 * names, registered emails) so that re-runs don't collide and cleanup can
 * filter precisely.
 */
export function newRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}
