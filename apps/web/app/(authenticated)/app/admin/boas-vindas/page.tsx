'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, Skeleton } from '@metanoia/ui';
import { useDemoRadar } from '@/lib/api/hooks';
import { WelcomeHeader } from './_components/welcome-header';
import { DemoRadarCard } from './_components/demo-radar-card';
import messages from '../../../../../messages/pt-BR.json';

export default function BoasVindasPage() {
  const router = useRouter();
  const { data, isLoading, error } = useDemoRadar();
  const t = messages.welcome;

  function goToCreateGroup() {
    router.push('/app/admin/grupos/novo?first=true');
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <WelcomeHeader adminName="Pastor" />

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
        <Button type="button" className="w-full max-w-sm" onClick={goToCreateGroup}>
          {t.action.createGroup}
        </Button>
      </div>
    </section>
  );
}
