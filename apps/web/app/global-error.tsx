'use client';

import { BoundaryFallback } from '@/components/ui/boundary-fallback';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <BoundaryFallback error={error} reset={reset} route="global" withRootShell />
  );
}
