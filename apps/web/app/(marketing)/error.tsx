'use client';

import { BoundaryFallback } from '@/components/ui/boundary-fallback';

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <BoundaryFallback error={error} reset={reset} route="marketing" />;
}
