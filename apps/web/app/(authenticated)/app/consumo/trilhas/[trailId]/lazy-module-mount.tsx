'use client';

import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// LazyModuleMount — IntersectionObserver-based lazy mount for modules below fold
// Ref: spec §FR-009 | plan.md §5
// ---------------------------------------------------------------------------

interface LazyModuleMountProps {
  children: React.ReactNode;
  /** Height in px to reserve while not yet visible (prevents CLS) */
  placeholderHeight: number;
}

export function LazyModuleMount({ children, placeholderHeight }: LazyModuleMountProps) {
  const [isMounted, setIsMounted] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || isMounted) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }, // pre-load 200px before entering viewport
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [isMounted]);

  if (!isMounted) {
    return (
      <div
        ref={placeholderRef}
        style={{ height: placeholderHeight }}
        className="bg-muted motion-safe:animate-pulse rounded-xl"
        aria-hidden="true"
        data-testid="lazy-module-placeholder"
      />
    );
  }

  return <>{children}</>;
}
