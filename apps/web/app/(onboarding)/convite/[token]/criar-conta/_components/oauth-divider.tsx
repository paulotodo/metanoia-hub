/**
 * Horizontal "——— ou ———" separator between the Google OAuth shortcut
 * and the email/password form (spec 05.3, `account.oauth.divider`).
 * Pure presentation; kept local to 05.3 so we don't over-generalize.
 */
export function OAuthDivider() {
  return (
    <div
      className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]"
      role="separator"
      aria-label="ou"
    >
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-[var(--color-border-default)]"
      />
      <span>ou</span>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-[var(--color-border-default)]"
      />
    </div>
  );
}
