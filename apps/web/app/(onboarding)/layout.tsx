"use client";

import dynamic from "next/dynamic";
import { AppQueryProvider } from "@/lib/query";
import { AsyncAnnouncerProvider } from "@/components/a11y/async-announcer";

const FocusManager = dynamic(
  () =>
    import("../(authenticated)/_components/focus-manager").then(
      (m) => ({ default: m.FocusManager }),
    ),
  { ssr: false },
);

/**
 * Public onboarding routes (Cenário 05 — pages 05.1/05.2/05.3).
 * No bottom navigation, no auth shell — the user is not yet authenticated.
 *
 * LAC-01 (A11y): header + footer HTML5 landmarks for banner/contentinfo roles.
 * LAC-05 (A11y): FocusManager manages focus on route changes between etapas.
 *               AsyncAnnouncerProvider enables polite live-region announcements.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppQueryProvider>
      <AsyncAnnouncerProvider>
        <header />
        <main id="conteudo" className="min-h-dvh bg-background">
          <FocusManager />
          {children}
        </main>
        <footer />
      </AsyncAnnouncerProvider>
    </AppQueryProvider>
  );
}
