import { Toaster } from "@metanoia/ui";
import { AppQueryProvider } from "@/lib/query";
import { NavigationShell } from "./_components/navigation-shell";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavigationShell>
      <AppQueryProvider>{children}</AppQueryProvider>
      <Toaster richColors position="top-right" />
    </NavigationShell>
  );
}
