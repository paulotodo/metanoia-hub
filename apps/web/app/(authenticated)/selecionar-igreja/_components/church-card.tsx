'use client';

import type { UserTenant } from '@metanoia/types';
import { Loader2 } from 'lucide-react';
import messages from '../../../../messages/pt-BR.json';

const t = messages.churchSelect;

function formatLastVisit(iso: string | null): string {
  if (!iso) return t.card.lastVisitNever;
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  return t.card.lastVisit.replace('{date}', formatted);
}

interface ChurchCardProps {
  tenant: UserTenant;
  isSelecting: boolean;
  disabled: boolean;
  onSelect: (tenantId: string) => void;
}

export function ChurchCard({
  tenant,
  isSelecting,
  disabled,
  onSelect,
}: ChurchCardProps) {
  const roleLabel = t.card.role[tenant.userRole];
  const a11yLabel = t.a11y.cardLabel
    .replace('{churchName}', tenant.churchName)
    .replace('{role}', roleLabel);

  return (
    <button
      type="button"
      aria-label={a11yLabel}
      disabled={disabled}
      onClick={() => onSelect(tenant.tenantId)}
      data-testid={`church-card-${tenant.tenantId}`}
      className="flex w-full items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-[var(--color-brand-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-teal)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className="text-2xl leading-none"
        data-testid="church-card-icon"
      >
        {isSelecting ? (
          <Loader2
            className="h-6 w-6 animate-spin text-[var(--color-brand-teal)]"
            data-testid="church-card-spinner"
          />
        ) : (
          '🏛'
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-base font-semibold text-[var(--color-text-primary)]">
          {tenant.churchName}
        </span>
        <span className="text-sm text-[var(--color-brand-teal)]">
          {roleLabel}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {formatLastVisit(tenant.lastVisit)}
        </span>
      </span>
    </button>
  );
}
