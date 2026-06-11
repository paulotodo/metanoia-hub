/**
 * TrailsEmptyState — shown when participant has no trails assigned to their groups.
 * Pastoral tone: invites the participant to engage with their leader.
 */
export function TrailsEmptyState() {
  return (
    <div
      role="status"
      aria-label="Nenhuma trilha disponível"
      className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center"
    >
      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
          aria-hidden="true"
        >
          {/* BookOpen icon */}
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">Nenhuma trilha disponível ainda.</p>
        <p className="text-sm text-muted-foreground">
          Fale com o líder do seu grupo para começar sua jornada de discipulado.
        </p>
      </div>
    </div>
  );
}
