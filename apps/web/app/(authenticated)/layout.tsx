import { AppQueryProvider } from "@/lib/query";
import { NavigationShell } from "./_components/navigation-shell";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppQueryProvider>
      <NavigationShell>{children}</NavigationShell>
    </AppQueryProvider>
  );
}
