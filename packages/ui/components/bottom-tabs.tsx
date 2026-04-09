import * as React from "react";
import { cn } from "../lib/utils";
import type { NavigationItem } from "./navigation-types";

export interface BottomTabsProps extends React.HTMLAttributes<HTMLElement> {
  items: NavigationItem[];
  activeKey: string;
  renderLink?: (
    item: NavigationItem,
    children: React.ReactNode,
    isActive: boolean,
  ) => React.ReactNode;
}

const BottomTabs = React.forwardRef<HTMLElement, BottomTabsProps>(
  ({ className, items, activeKey, renderLink, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="Mobile navigation"
        className={cn(
          "fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border)] bg-[var(--background)]",
          className,
        )}
        {...props}
      >
        <ul className="flex items-center justify-around">
          {items.map((item) => {
            const isActive = item.key === activeKey;
            const Icon = isActive && item.activeIcon ? item.activeIcon : item.icon;

            const content = (
              <>
                <Icon className="size-5 shrink-0" />
                <span
                  className={cn(
                    "text-[0.6875rem] leading-tight",
                    !isActive && "max-[360px]:hidden",
                  )}
                >
                  {item.label}
                </span>
              </>
            );

            const linkClasses = cn(
              "flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2 py-2",
              "motion-safe:transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded-md",
              isActive
                ? "text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
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
BottomTabs.displayName = "BottomTabs";

export { BottomTabs };
