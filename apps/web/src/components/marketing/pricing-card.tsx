import Link from 'next/link';
import { Button } from '@metanoia/ui';
import type { PricingPlanId } from '@metanoia/types';

export function PricingCard({
  planId,
  name,
  price,
  description,
  cta,
  href,
  highlighted = false,
}: {
  planId: PricingPlanId;
  name: string;
  price: string;
  description: string;
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <article
      data-testid={`pricing-card-${planId}`}
      className={[
        'flex flex-col rounded-lg border p-8',
        highlighted
          ? 'border-[var(--color-text-primary)] bg-surface-base shadow-md'
          : 'border-[var(--color-border-default)] bg-surface-base',
      ].join(' ')}
    >
      <h3 className="text-xl font-semibold text-text-primary">{name}</h3>
      <p className="mt-2 text-base text-secondary">{price}</p>
      <p className="mt-6 flex-1 text-base leading-relaxed text-secondary">
        {description}
      </p>
      <div className="mt-8">
        <Button
          asChild
          variant={highlighted ? 'default' : 'outline'}
          size="lg"
          className="w-full"
          data-testid={`pricing-card-${planId}-cta`}
        >
          <Link href={href}>{cta}</Link>
        </Button>
      </div>
    </article>
  );
}
