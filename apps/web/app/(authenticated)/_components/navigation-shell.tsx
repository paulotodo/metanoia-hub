"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BottomTabs, Sidebar } from "@metanoia/ui";
import type { NavigationItem } from "@metanoia/ui";
import { navigationItems } from "../../../config/navigation";
import { TenantSwitcher } from "@/components/tenant/tenant-switcher";
import { AsyncAnnouncerProvider } from "@/components/a11y/async-announcer";

/**
 * FocusManager importado via dynamic() com ssr:false.
 * Necessário porque usa usePathname() — hook de rota que não pode ser
 * executado no servidor (CL-001/TD-001).
 */
const FocusManager = dynamic(
  () =>
    import("./focus-manager").then((m) => ({ default: m.FocusManager })),
  { ssr: false },
);

/**
 * NotificationCenter importado via dynamic() com ssr:false.
 * Usa hooks de client-side (TanStack Query, SSE, localStorage).
 */
const NotificationCenter = dynamic(
  () =>
    import("@/components/notifications/notification-center").then(
      (m) => ({ default: m.NotificationCenter }),
    ),
  { ssr: false },
);

interface NavigationShellProps {
  children: React.ReactNode;
}

export function NavigationShell({ children }: NavigationShellProps) {
  const items = navigationItems;
  const pathname = usePathname();
  const activeKey =
    items.find(
      (item) =>
        pathname === item.href || pathname.startsWith(item.href + "/"),
    )?.key ?? items[0]?.key;

  const renderLink = (
    item: NavigationItem,
    content: React.ReactNode,
    isActive: boolean,
  ) => (
    <Link
      href={item.href}
      {...(isActive ? { "aria-current": "page" as const } : {})}
    >
      {content}
    </Link>
  );

  return (
    <AsyncAnnouncerProvider>
      {/* FocusManager: move foco para elemento semântico após mudança de rota */}
      <FocusManager />
      <header
        data-testid="mobile-tenant-header"
        className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-4 py-2 lg:hidden"
      >
        <TenantSwitcher />
        <NotificationCenter />
      </header>
      <Sidebar
        items={items}
        activeKey={activeKey}
        renderLink={renderLink}
        header={
          <div className="flex flex-col gap-2" data-testid="desktop-tenant-header">
            <TenantSwitcher className="w-full" />
            <NotificationCenter />
          </div>
        }
        className="hidden lg:flex"
      />
      <main id="conteudo" className="pb-16 lg:ml-60 lg:pb-0">
        <div className="mx-auto max-w-7xl px-4">{children}</div>
      </main>
      <BottomTabs
        items={items}
        activeKey={activeKey}
        renderLink={renderLink}
        className="lg:hidden"
      />
    </AsyncAnnouncerProvider>
  );
}
