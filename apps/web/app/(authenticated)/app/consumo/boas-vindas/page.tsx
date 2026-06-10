'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@metanoia/ui';
import { useCompleteOnboarding } from '@/lib/api/hooks/use-users';
import { useCurrentFirstName } from '@/lib/session/use-current-first-name';
import messages from '../../../../../messages/pt-BR.json';

export default function ParticipanteBoasVindasPage() {
  const router = useRouter();
  const { mutate: completeOnboarding, isPending } = useCompleteOnboarding();
  const firstName = useCurrentFirstName();
  const tp = messages.welcome.firstAccess.participante;

  const heading = tp.heading.replace('{name}', firstName ?? 'bem-vindo');

  function handleViewGroups() {
    completeOnboarding(undefined, {
      onSuccess: () => {
        router.push('/app/consumo/grupos');
      },
      onError: () => {
        router.push('/app/consumo/grupos');
      },
    });
  }

  return (
    <section
      className="mx-auto max-w-2xl space-y-6 px-6 py-10 text-center"
      data-testid="participante-welcome-view"
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
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
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
        <p className="text-base text-text-secondary">{tp.body}</p>
      </header>

      <Button
        type="button"
        className="w-full max-w-sm"
        onClick={handleViewGroups}
        disabled={isPending}
        data-testid="welcome-cta"
      >
        {tp.cta}
      </Button>
    </section>
  );
}
