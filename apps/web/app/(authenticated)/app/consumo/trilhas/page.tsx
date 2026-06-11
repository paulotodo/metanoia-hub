'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMyTrails } from '@/lib/api/hooks/use-my-trails';
import { TrailCard } from '@/components/content/trail-card';
import { TrailCardSkeletonList } from '@/components/content/trail-card-skeleton';
import { TrailsEmptyState } from '@/components/content/trails-empty-state';

/**
 * /app/consumo/trilhas — "Minhas Trilhas"
 * Lists published trails assigned to the current participant's groups.
 * Infinite scroll via IntersectionObserver + TanStack Query useInfiniteQuery.
 */
export default function MinhasTrilhasPage() {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = useMyTrails();

  // IntersectionObserver — load next page when sentinel enters viewport
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const first = entries[0];
      if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersection]);

  const trails = data?.pages.flatMap((page) => page.data) ?? [];

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Minhas Trilhas</h1>
        <TrailCardSkeletonList count={3} />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Minhas Trilhas</h1>
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas trilhas. Verifique sua conexão e tente novamente.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Minhas Trilhas</h1>

      {trails.length === 0 ? (
        <TrailsEmptyState />
      ) : (
        <>
          <ul className="flex flex-col gap-4" aria-label="Lista de trilhas">
            {trails.map((trail) => (
              <li key={trail.id}>
                <TrailCard
                  trail={trail}
                  onClick={() => {
                    router.push(`/app/consumo/trilhas/${trail.id}`);
                  }}
                />
              </li>
            ))}
          </ul>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} aria-hidden="true" className="h-4" />

          {isFetchingNextPage && (
            <div className="mt-4" aria-live="polite" aria-label="Carregando mais trilhas...">
              <TrailCardSkeletonList count={2} />
            </div>
          )}

          {!hasNextPage && trails.length > 0 && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Você viu todas as suas trilhas.
            </p>
          )}
        </>
      )}
    </main>
  );
}
