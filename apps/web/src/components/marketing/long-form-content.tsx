import type { ReactNode } from 'react';

export function LongFormContent({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[680px] px-4 text-base leading-relaxed text-text-primary [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:mt-6 [&_p]:text-lg [&_p]:text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}
