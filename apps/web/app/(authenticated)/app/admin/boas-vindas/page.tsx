'use client';

import { useRouter } from 'next/navigation';
import { Button, Card } from '@metanoia/ui';
import { useDemoRadar } from '@/lib/api/hooks';
import { useCompleteOnboarding } from '@/lib/api/hooks/use-users';
import { useCurrentFirstName } from '@/lib/session/use-current-first-name';
import { WelcomeHeader } from './_components/welcome-header';
import { DemoRadarCard } from './_components/demo-radar-card';
import messages from '../../../../../messages/pt-BR.json';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-surface-subtle animate-pulse rounded-md ${className}`} />;
}

export default function BoasVindasPage() {
  const router = useRouter();
  const { data, isLoading, error } = useDemoRadar();
  const { mutate: completeOnboarding, isPending } = useCompleteOnboarding();
  const firstName = useCurrentFirstName();
  const t = messages.welcome;
  const ta = messages.welcome.firstAccess.admin;

  function handleCreateGroup() {
    completeOnboarding(undefined, {
      onSuccess: () => {
        router.push('/app/admin/grupos/novo?first=true');
      },
      onError: () => {
        // Onboarding completion is best-effort — proceed even if the API call fails
        router.push('/app/admin/grupos/novo?first=true');
      },
    });
  }

  return (
    <section
      className="mx-auto max-w-2xl space-y-6 px-6 py-10"
      data-testid="admin-welcome-view"
    >
      <WelcomeHeader name={firstName ?? 'Pastor'} />

      <p className="text-center text-base text-text-secondary">{ta.body}</p>

      {isLoading && (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </Card>
      )}

      {error && (
        <Card className="p-6">
          <p className="text-sm text-text-secondary">{t.error.demoUnavailable}</p>
        </Card>
      )}

      {data && <DemoRadarCard data={data} />}

      <div className="flex justify-center">
        <Button
          type="button"
          className="w-full max-w-sm"
          onClick={handleCreateGroup}
          disabled={isPending}
          data-testid="welcome-cta"
        >
          {ta.cta}
        </Button>
      </div>
    </section>
  );
}
