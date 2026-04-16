import type { Metadata } from 'next';
import { PricingPlanIdSchema, type PricingPlanId } from '@metanoia/types';
import { PricingCard } from '../../../src/components/marketing/pricing-card';
import { FaqAccordion } from '../../../src/components/marketing/faq-accordion';
import messages from '../../../messages/pt-BR.json';

const t = messages.precos;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

const PLAN_HREFS: Record<PricingPlanId, string> = {
  free: '/comecar',
  pro: '/comecar',
  enterprise: '/contato',
};

const PLANS = PricingPlanIdSchema.options.map((id) => ({
  id,
  ...t.plans[id],
  href: PLAN_HREFS[id],
}));

export default function PrecosPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-muted)]">
          {t.subtitle}
        </p>
      </header>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            planId={plan.id}
            name={plan.name}
            price={plan.price}
            description={plan.description}
            cta={plan.cta}
            href={plan.href}
            highlighted={plan.id === 'pro'}
          />
        ))}
      </div>

      <FaqAccordion />
    </section>
  );
}
