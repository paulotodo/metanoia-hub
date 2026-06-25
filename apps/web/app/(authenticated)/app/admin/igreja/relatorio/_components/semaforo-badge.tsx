import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.tenantReport.semaforo;

export type Semaforo = 'verde' | 'amarelo' | 'vermelho';

const VISUALS: Record<
  Semaforo,
  {
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true'; focusable?: 'false' }>;
    text: string;
    bg: string;
    label: string;
  }
> = {
  verde: {
    Icon: CheckCircle2,
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    label: t.verde,
  },
  amarelo: {
    Icon: AlertTriangle,
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    label: t.amarelo,
  },
  vermelho: {
    Icon: AlertCircle,
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    label: t.vermelho,
  },
};

interface SemaforoBadgeProps {
  status: Semaforo;
  className?: string;
}

/**
 * Badge de semáforo pastoral acessível: combina ÍCONE Lucide + TEXTO além da cor
 * (WCAG 1.4.1 — informação não transmitida apenas por cor). O ícone é
 * aria-hidden + focusable=false; o texto carrega o significado para leitores de tela.
 * Story 15.3: Unicode (●▲■) substituído por Lucide (dec-007, research D1/D2).
 */
export function SemaforoBadge({ status, className = '' }: SemaforoBadgeProps) {
  const visual = VISUALS[status];
  return (
    <span
      data-testid={`semaforo-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${visual.bg} ${visual.text} ${className}`}
    >
      {/* Ícone Lucide: aria-hidden + focusable=false — o texto carrega o significado */}
      <visual.Icon
        className="size-3.5 shrink-0"
        aria-hidden="true"
        focusable="false"
      />
      {visual.label}
    </span>
  );
}
