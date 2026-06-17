'use client';

import type { MyTrailItem, MyTrailStatus } from '@metanoia/types';
import { TrailProgressBar } from './trail-progress-bar';

// ---------------------------------------------------------------------------
// StatusBadge — badge de status da trilha
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<MyTrailStatus, string> = {
  not_started: 'Não Iniciada',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
};

const STATUS_CLASSES: Record<MyTrailStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function StatusBadge({ status }: { status: MyTrailStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TrailCard
// ---------------------------------------------------------------------------

interface TrailCardProps {
  trail: MyTrailItem;
  onClick?: () => void;
}

/**
 * Card de trilha para a tela "Minhas Trilhas".
 * Consumo density: padding 20-24px, radius 12px (rounded-xl = 12px).
 * Touch target ≥ 44px.
 */
export function TrailCard({ trail, onClick }: TrailCardProps) {
  const formattedLastActivity = trail.lastActivity
    ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(trail.lastActivity),
      )
    : null;

  return (
    <article
      role="article"
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-brand-teal/30 focus-within:ring-offset-2"
    >
      {/* Header: name + badge */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onClick}
          className="flex-1 text-left min-h-[44px] focus-visible:outline-none"
          aria-label={`Abrir trilha: ${trail.name}`}
        >
          <h2 className="text-base font-semibold text-foreground group-hover:text-primary motion-safe:transition-colors leading-tight">
            {trail.name}
          </h2>
        </button>
        <StatusBadge status={trail.status} />
      </div>

      {/* Description (2 lines max) */}
      {trail.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {trail.description}
        </p>
      )}

      {/* Meta: modules + lessons */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{trail.moduleCount}</strong>{' '}
          {trail.moduleCount === 1 ? 'módulo' : 'módulos'}
        </span>
        <span>
          <strong className="text-foreground">{trail.lessonCount}</strong>{' '}
          {trail.lessonCount === 1 ? 'aula' : 'aulas'}
        </span>
        {formattedLastActivity && (
          <span className="ml-auto">
            Última atividade: <time dateTime={trail.lastActivity ?? undefined}>{formattedLastActivity}</time>
          </span>
        )}
      </div>

      {/* Progress bar */}
      <TrailProgressBar
        progressPercent={trail.progressPercent}
        label={`${trail.name} — ${trail.progressPercent}% concluída`}
      />
    </article>
  );
}
