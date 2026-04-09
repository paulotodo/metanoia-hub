import * as React from "react";
import { cn } from "../lib/utils";
import type { NavigationItem } from "./navigation-types";

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  items: NavigationItem[];
  activeKey: string;
  renderLink?: (
    item: NavigationItem,
    children: React.ReactNode,
    isActive: boolean,
  ) => React.ReactNode;
  header?: React.ReactNode;
}

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ className, items, activeKey, renderLink, header, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-0 bottom-0 w-60 flex flex-col border-r border-[var(--border)] bg-[var(--background)]",
          className,
        )}
        {...props}
      >
        {header && <div className="px-4 py-4">{header}</div>}
        <ul className="flex flex-1 flex-col gap-1 px-3 py-4">
          {items.map((item) => {
            const isActive = item.key === activeKey;
            const Icon =
              isActive && item.activeIcon ? item.activeIcon : item.icon;

            const content = (
              <>
                <Icon className="size-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </>
            );

            const linkClasses = cn(
              "flex items-center gap-3 rounded-lg px-4 py-3",
              "motion-safe:transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
              isActive
                ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            );

            if (renderLink) {
              return (
                <li key={item.key}>
                  {renderLink(
                    item,
                    <span className={linkClasses}>{content}</span>,
                    isActive,
                  )}
                </li>
              );
            }

            return (
              <li key={item.key}>
                <a
                  href={item.href}
                  className={linkClasses}
                  {...(isActive ? { "aria-current": "page" as const } : {})}
                >
                  {content}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  },
);
Sidebar.displayName = "Sidebar";

export { Sidebar };
