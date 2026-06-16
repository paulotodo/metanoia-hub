"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BottomTabs, Sidebar } from "@metanoia/ui";
import type { NavigationItem } from "@metanoia/ui";
import { navigationItems } from "../../../config/navigation";
import { TenantSwitcher } from "@/components/tenant/tenant-switcher";

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
    <>
      <header
        data-testid="mobile-tenant-header"
        className="sticky top-0 z-30 flex items-center justify-center border-b border-[var(--border)] bg-[var(--background)] px-4 py-2 lg:hidden"
      >
        <TenantSwitcher />
      </header>
      <Sidebar
        items={items}
        activeKey={activeKey}
        renderLink={renderLink}
        header={<TenantSwitcher className="w-full" />}
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
    </>
  );
}
