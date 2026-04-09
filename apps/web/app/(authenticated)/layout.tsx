import { navigationItems } from "../../config/navigation";
import { NavigationShell } from "./_components/navigation-shell";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NavigationShell items={navigationItems}>{children}</NavigationShell>;
}
