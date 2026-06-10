'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@metanoia/ui';
import { useCompleteOnboarding } from '@/lib/api/hooks/use-users';
import { useCurrentFirstName } from '@/lib/session/use-current-first-name';
import messages from '../../../../../messages/pt-BR.json';

export default function LiderBoasVindasPage() {
  const router = useRouter();
  const { mutate: completeOnboarding, isPending } = useCompleteOnboarding();
  const firstName = useCurrentFirstName();
  const tl = messages.welcome.firstAccess.lider;

  const heading = tl.heading.replace('{name}', firstName ?? 'Líder');

  function handleOpenRadar() {
    completeOnboarding(undefined, {
      onSuccess: () => {
        router.push('/app/gestao/radar');
      },
      onError: () => {
        router.push('/app/gestao/radar');
      },
    });
  }

  return (
    <section
      className="mx-auto max-w-2xl space-y-6 px-6 py-10 text-center"
      data-testid="lider-welcome-view"
    >
      {/* Pastoral illustration placeholder */}
      <div
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-subtle"
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-12 w-12 text-brand"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
          />
        </svg>
      </div>

      <header className="space-y-2">
        <h1
          className="text-2xl font-bold text-text-primary lg:text-3xl"
          data-testid="welcome-heading"
        >
          {heading}
        </h1>
        <p className="text-base text-text-secondary">{tl.body}</p>
      </header>

      <Button
        type="button"
        className="w-full max-w-sm"
        onClick={handleOpenRadar}
        disabled={isPending}
        data-testid="welcome-cta"
      >
        {tl.cta}
      </Button>
    </section>
  );
}
