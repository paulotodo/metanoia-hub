import { AppQueryProvider } from "@/lib/query";

/**
 * Public onboarding routes (Cenário 05 — pages 05.1/05.2/05.3).
 * No bottom navigation, no auth shell — the user is not yet authenticated.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppQueryProvider>
      <main className="min-h-dvh bg-background">{children}</main>
    </AppQueryProvider>
  );
}
