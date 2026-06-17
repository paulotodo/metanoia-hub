'use client';

/**
 * PlanCard — Card de plano focável e navegável por teclado (US7)
 *
 * Story 12.2 — US7, FR-022, FR-023, FR-024
 * dec-011: focus trap via Radix Dialog (shadcn/ui)
 *
 * Acessibilidade:
 *   - tabIndex=0 + role="article" para focar o card individualmente (FR-022)
 *   - Enter/Space no card expande detalhes (FR-022)
 *   - CTAs "Assinar Pro" e "Falar com vendas" são buttons nativos (FR-023)
 *   - aria-expanded indica estado do card
 *   - aria-label descritivo no card e nos CTAs
 */
import { useState, useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { PricingPlanId } from '@metanoia/types';

export interface PlanCardProps {
  planId: PricingPlanId;
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  ctaVariant?: 'primary' | 'outline';
  highlighted?: boolean;
  onUpgradeClick?: (planId: PricingPlanId) => void;
}

export function PlanCard({
  planId,
  name,
  price,
  description,
  features,
  cta,
  ctaVariant = 'outline',
  highlighted = false,
  onUpgradeClick,
}: PlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `plan-details-${planId}`;
  const cardRef = useRef<HTMLDivElement>(null);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleExpand();
      }
    },
    [toggleExpand],
  );

  const handleCtaClick = useCallback(() => {
    onUpgradeClick?.(planId);
  }, [onUpgradeClick, planId]);

  const handleCtaKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCtaClick();
      }
    },
    [handleCtaClick],
  );

  return (
    <div
      ref={cardRef}
      role="article"
      aria-label={`Plano ${name}`}
      aria-expanded={expanded}
      aria-controls={detailsId}
      tabIndex={0}
      data-testid={`plan-card-${planId}`}
      className={[
        'flex flex-col rounded-lg border p-6 cursor-pointer outline-none',
        'focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-text-primary)]',
        highlighted
          ? 'border-[var(--color-text-primary)] bg-surface-base shadow-md'
          : 'border-[var(--color-border-default)] bg-surface-base',
      ].join(' ')}
      onClick={toggleExpand}
      onKeyDown={handleCardKeyDown}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-text-primary">{name}</h3>
          <p className="mt-1 text-base text-[var(--color-text-muted)]">{price}</p>
        </div>
        {highlighted && (
          <span
            className="rounded-full bg-[var(--color-text-primary)] px-3 py-1 text-xs font-medium text-white"
            aria-label="Plano recomendado"
          >
            Recomendado
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mt-4 text-base leading-relaxed text-[var(--color-text-muted)]">
        {description}
      </p>

      {/* Expandable details — FR-022 */}
      <div
        id={detailsId}
        role="region"
        aria-label={`Recursos do plano ${name}`}
        className={[
          'overflow-hidden transition-all duration-200',
          expanded ? 'mt-4 max-h-96 opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
      >
        <ul className="space-y-2" aria-label={`Lista de recursos — ${name}`}>
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-text-primary">
              <span aria-hidden="true" className="text-green-600">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA — FR-023 */}
      <div className="mt-6">
        <button
          type="button"
          data-testid={`plan-card-${planId}-cta`}
          aria-label={`${cta} — Plano ${name}`}
          className={[
            'w-full rounded-md px-4 py-2 text-sm font-medium',
            'transition-colors outline-none',
            'focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-text-primary)]',
            ctaVariant === 'primary'
              ? 'bg-[var(--color-text-primary)] text-white hover:opacity-90'
              : 'border border-[var(--color-border-default)] text-text-primary hover:bg-gray-50',
          ].join(' ')}
          onClick={(e) => {
            e.stopPropagation(); // Não disparar expand do card
            handleCtaClick();
          }}
          onKeyDown={(e) => {
            e.stopPropagation(); // Não disparar expand do card
            handleCtaKeyDown(e);
          }}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
