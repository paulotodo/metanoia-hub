"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BottomTabs, Sidebar } from "@metanoia/ui";
import type { NavigationItem } from "@metanoia/ui";
import { navigationItems } from "../../../config/navigation";

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
      <Sidebar
        items={items}
        activeKey={activeKey}
        renderLink={renderLink}
        className="hidden lg:flex"
      />
      <main className="pb-16 lg:ml-60 lg:pb-0">
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
