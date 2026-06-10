'use client';

// ---------------------------------------------------------------------------
// LockIndicator — exibe cadeado para módulos/aulas bloqueados por acesso
// sequencial ou pré-requisitos não concluídos (Story 8-5)
// ---------------------------------------------------------------------------

interface LockIndicatorProps {
  /** Razão do bloqueio exibida no tooltip (vocabulário pastoral) */
  reason?: string;
  /** Classe CSS adicional para posicionamento */
  className?: string;
  /** Tamanho do ícone em pixels (default: 16) */
  size?: number;
}

const DEFAULT_REASON = 'Complete o conteúdo anterior para desbloquear este módulo';

/**
 * LockIndicator — ícone de cadeado com tooltip explicativo.
 * Acessível via aria-label e role="img".
 */
export function LockIndicator({
  reason = DEFAULT_REASON,
  className,
  size = 16,
}: LockIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center justify-center text-muted-foreground ${className ?? ''}`}
      title={reason}
      aria-label={`Bloqueado: ${reason}`}
      role="img"
      data-testid="lock-indicator"
    >
      {/* Simple SVG lock icon — no external icon lib dependency */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// LockedModuleCard — wrapper que aplica visual de bloqueado a um módulo
// ---------------------------------------------------------------------------

interface LockedModuleCardProps {
  /** Conteúdo a renderizar dentro do card */
  children: React.ReactNode;
  /** Se true, exibe overlay e cadeado */
  isLocked: boolean;
  /** Razão do bloqueio */
  lockReason?: string;
  className?: string;
}

/**
 * LockedModuleCard — aplica estado visual locked/unlocked a um card de módulo.
 * Quando locked: opacidade reduzida + pointer-events-none + LockIndicator.
 */
export function LockedModuleCard({
  children,
  isLocked,
  lockReason,
  className,
}: LockedModuleCardProps) {
  if (!isLocked) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`relative ${className ?? ''}`}
      aria-disabled="true"
      data-testid="locked-module-card"
    >
      <div className="opacity-50 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <LockIndicator
          reason={lockReason}
          size={24}
          className="bg-background/80 rounded-full p-2"
        />
      </div>
    </div>
  );
}
