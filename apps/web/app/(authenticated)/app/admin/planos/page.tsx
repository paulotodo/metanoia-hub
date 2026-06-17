'use client';

/**
 * PlansPage — Gestão de Planos e Upgrade (US7)
 *
 * Story 12.2 — US7, FR-022, FR-023, FR-024
 * dec-011: focus trap via Radix Dialog (shadcn/ui)
 *
 * Acessibilidade:
 *   - Tabela de comparação de planos (FR-022)
 *   - Cards focáveis com Tab (FR-022)
 *   - CTAs ativáveis por teclado (FR-023)
 *   - Diálogo de upgrade com focus trap (FR-024)
 */
'use client';

import { useState, useCallback } from 'react';
import type { PricingPlanId } from '@metanoia/types';
import { PlanCard } from '@/components/plans/plan-card';
import { UpgradeDialog } from '@/components/plans/upgrade-dialog';

// ---------------------------------------------------------------------------
// Dados de planos — em produção viria de API/server component
// ---------------------------------------------------------------------------
const PLANS: Array<{
  planId: PricingPlanId;
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  ctaVariant: 'primary' | 'outline';
  highlighted: boolean;
}> = [
  {
    planId: 'free',
    name: 'Gratuito',
    price: 'R$ 0 / mês',
    description: 'Para igrejas que estão começando a digitalizar sua comunicação pastoral.',
    features: [
      'Até 50 membros',
      'Radar Pastoral básico',
      'Grupos ilimitados',
      'Suporte por e-mail',
    ],
    cta: 'Plano atual',
    ctaVariant: 'outline',
    highlighted: false,
  },
  {
    planId: 'pro',
    name: 'Pro',
    price: 'R$ 149 / mês',
    description: 'Para igrejas em crescimento que precisam de visibilidade pastoral completa.',
    features: [
      'Membros ilimitados',
      'Radar Pastoral avançado com alertas',
      'Relatórios detalhados',
      'Personalização de marca',
      'Suporte prioritário',
      'Integrações API',
    ],
    cta: 'Assinar Pro',
    ctaVariant: 'primary',
    highlighted: true,
  },
  {
    planId: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    description: 'Para redes de igrejas e denominações com necessidades específicas.',
    features: [
      'Tudo do Pro',
      'Multi-tenancy por denominação',
      'SLA dedicado',
      'Onboarding personalizado',
      'Gerente de conta exclusivo',
    ],
    cta: 'Falar com vendas',
    ctaVariant: 'outline',
    highlighted: false,
  },
];

// Dados de comparação para a tabela (FR-022)
const COMPARISON_FEATURES = [
  { label: 'Membros', free: 'Até 50', pro: 'Ilimitado', enterprise: 'Ilimitado' },
  { label: 'Radar Pastoral', free: 'Básico', pro: 'Avançado + alertas', enterprise: 'Avançado + alertas' },
  { label: 'Relatórios', free: '—', pro: 'Detalhados', enterprise: 'Customizados' },
  { label: 'Suporte', free: 'E-mail', pro: 'Prioritário', enterprise: 'Gerente dedicado' },
  { label: 'Personalização de marca', free: '—', pro: '✓', enterprise: '✓' },
  { label: 'API', free: '—', pro: '✓', enterprise: '✓' },
  { label: 'SLA dedicado', free: '—', pro: '—', enterprise: '✓' },
];

export default function PlansPage() {
  const [upgradeTarget, setUpgradeTarget] = useState<PricingPlanId | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleUpgradeClick = useCallback((planId: PricingPlanId) => {
    if (planId === 'free') return; // Sem ação para plano atual
    setUpgradeTarget(planId);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setUpgradeTarget(null);
  }, []);

  const handleConfirmUpgrade = useCallback((planId: PricingPlanId) => {
    // Em produção: redirecionar para fluxo de pagamento
    console.info(`Upgrade confirmado para plano: ${planId}`);
    handleDialogClose();
  }, [handleDialogClose]);

  const targetPlan = PLANS.find((p) => p.planId === upgradeTarget);

  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl px-4 py-8"
      aria-label="Gestão de Planos"
    >
      <header>
        <h1 className="text-3xl font-semibold text-text-primary">Planos e Upgrade</h1>
        <p className="mt-2 text-base text-[var(--color-text-muted)]">
          Escolha o plano ideal para sua igreja. Navegue pelos cards com Tab e pressione
          Enter para ver os detalhes de cada plano.
        </p>
      </header>

      {/* Tabela de comparação — FR-022 */}
      <section aria-label="Comparação de planos" className="mt-10">
        <h2 className="sr-only">Tabela de comparação de recursos</h2>
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            aria-label="Comparação de recursos entre os planos"
          >
            <caption className="sr-only">
              Comparação de recursos entre os planos Gratuito, Pro e Enterprise
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-[var(--color-border-default)] py-3 pr-4 text-left font-medium text-text-primary"
                >
                  Recurso
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.planId}
                    scope="col"
                    className="border-b border-[var(--color-border-default)] py-3 px-4 text-center font-medium text-text-primary"
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? 'bg-surface-base' : 'bg-gray-50'}
                >
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-normal text-text-primary"
                  >
                    {row.label}
                  </th>
                  <td className="py-3 px-4 text-center text-[var(--color-text-muted)]">
                    {row.free}
                  </td>
                  <td className="py-3 px-4 text-center text-[var(--color-text-muted)]">
                    {row.pro}
                  </td>
                  <td className="py-3 px-4 text-center text-[var(--color-text-muted)]">
                    {row.enterprise}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cards de plano focáveis — FR-022, FR-023 */}
      <section aria-label="Seleção de plano" className="mt-10">
        <h2 className="sr-only">Cards de plano</h2>
        <div
          className="grid gap-6 md:grid-cols-3"
          role="list"
          aria-label="Planos disponíveis"
        >
          {PLANS.map((plan) => (
            <div key={plan.planId} role="listitem">
              <PlanCard
                planId={plan.planId}
                name={plan.name}
                price={plan.price}
                description={plan.description}
                features={plan.features}
                cta={plan.cta}
                ctaVariant={plan.ctaVariant}
                highlighted={plan.highlighted}
                onUpgradeClick={handleUpgradeClick}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Diálogo de upgrade — FR-024, focus trap via Radix */}
      <UpgradeDialog
        open={dialogOpen}
        planId={upgradeTarget}
        planName={targetPlan?.name ?? ''}
        onConfirm={handleConfirmUpgrade}
        onClose={handleDialogClose}
      />
    </main>
  );
}
