import { NavigationShell } from "./_components/navigation-shell";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NavigationShell>{children}</NavigationShell>;
}
