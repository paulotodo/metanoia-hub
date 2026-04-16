'use client';

import messages from '../../../../../../../messages/pt-BR.json';
import type { VistaFilter } from '../vista-filters';

const t = messages.vista.filter;

interface VistaFilterBarProps {
  active: VistaFilter;
  onChange: (next: VistaFilter) => void;
}

const OPTIONS: Array<{ key: VistaFilter; label: string }> = [
  { key: 'all', label: t.all },
  { key: 'atencao', label: t.attention },
  { key: 'sem-sinal', label: t.noSignal },
];

export function VistaFilterBar({ active, onChange }: VistaFilterBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Filtro de grupos"
      className="flex flex-wrap gap-2"
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.key === active;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.key)}
            className={`rounded-full border px-4 py-1.5 text-body-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-text-primary hover:bg-surface-hover'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
