import { AppQueryProvider } from "@/lib/query";
import { NavigationShell } from "./_components/navigation-shell";
import { OnboardingRedirectGuard } from "./_components/onboarding-redirect-guard";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppQueryProvider>
      <NavigationShell>
        <OnboardingRedirectGuard>{children}</OnboardingRedirectGuard>
      </NavigationShell>
    </AppQueryProvider>
  );
}
