/**
 * Spec 06.2 page state "Loading" — Logo + skeleton shown while the
 * Server Component awaits the `/resolve` response.
 */
export function InviteLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Abrindo convite"
      className="flex w-full flex-col items-center gap-6"
    >
      <div className="size-[72px] motion-safe:animate-pulse rounded-full bg-[var(--color-surface-muted)]" />
      <div className="h-6 w-3/4 motion-safe:animate-pulse rounded bg-[var(--color-surface-muted)]" />
      <div className="h-12 w-full motion-safe:animate-pulse rounded bg-[var(--color-surface-muted)]" />
    </div>
  );
}
