"use client";

/**
 * sidebar.tsx — Sidebar navigation component with roving tabindex (WCAG 2.1 SC 2.1.1)
 *
 * Story 12.2 — US1, FR-003, FR-004, FR-005, CL-003
 * CHK009: Wrap circular + Home/End implementados via useRovingTabindex inline.
 *
 * Roving tabindex: apenas um item tem tabindex=0 por vez; Arrow Up/Down navega;
 * Home vai ao primeiro; End vai ao último; wrap circular ativo.
 */

import * as React from "react";
import { useCallback, useRef } from "react";
import { cn } from "../lib/utils";
import type { NavigationItem } from "./navigation-types";

// ---------------------------------------------------------------------------
// useRovingTabindex — implementação inline (packages/ui não tem acesso a apps/web/src/hooks)
// Mesma semântica do hook em apps/web/src/hooks/use-roving-tabindex.ts
// CHK009: wrap circular + Home/End documentados.
// ---------------------------------------------------------------------------
function useSidebarRovingTabindex() {
  const containerRef = useRef<HTMLElement | null>(null);

  const getFocusableItems = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled") && !el.closest("[disabled]"));
  }, []);

  const activateItem = useCallback((items: HTMLElement[], index: number) => {
    items.forEach((item, i) => {
      item.setAttribute("tabindex", i === index ? "0" : "-1");
    });
    items[index]?.focus();
  }, []);

  /**
   * Inicializa tabindex: item ativo (ou primeiro) recebe tabindex=0; demais -1.
   * Chamado no mount e quando activeKey muda.
   */
  const initTabindex = useCallback(
    (activeIndex: number) => {
      const items = getFocusableItems();
      if (items.length === 0) return;
      const idx = activeIndex >= 0 && activeIndex < items.length ? activeIndex : 0;
      items.forEach((item, i) => {
        item.setAttribute("tabindex", i === idx ? "0" : "-1");
      });
    },
    [getFocusableItems],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const items = getFocusableItems();
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      // CHK009: Arrow Up/Down com wrap circular
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex =
          currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        activateItem(items, prevIndex);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex =
          currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
        activateItem(items, nextIndex);
        return;
      }

      // CHK009: Home/End
      if (event.key === "Home") {
        event.preventDefault();
        activateItem(items, 0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        activateItem(items, items.length - 1);
        return;
      }

      // Enter/Space: aciona o item focado
      if (event.key === "Enter" || event.key === " ") {
        const current = document.activeElement as HTMLElement | null;
        if (current && containerRef.current?.contains(current)) {
          event.preventDefault();
          current.click();
        }
      }
    },
    [getFocusableItems, activateItem],
  );

  return { containerRef, onKeyDown, initTabindex };
}

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

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
    const { containerRef, onKeyDown, initTabindex } =
      useSidebarRovingTabindex();

    // Combina o ref externo e o containerRef interno
    const setRefs = useCallback(
      (node: HTMLElement | null) => {
        (containerRef as React.MutableRefObject<HTMLElement | null>).current =
          node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLElement | null>).current = node;
        }
      },
      [containerRef, ref],
    );

    // Inicializa tabindex quando items ou activeKey mudam
    React.useLayoutEffect(() => {
      const activeIndex = items.findIndex((item) => item.key === activeKey);
      initTabindex(activeIndex);
    }, [items, activeKey, initTabindex]);

    return (
      <nav
        ref={setRefs}
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-0 bottom-0 w-60 flex flex-col border-r border-[var(--border)] bg-[var(--background)]",
          className,
        )}
        onKeyDown={onKeyDown}
        {...props}
      >
        {header && <div className="px-4 py-4">{header}</div>}
        <ul
          role="list"
          className="flex flex-1 flex-col gap-1 px-3 py-4"
        >
          {items.map((item, index) => {
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
              // A.3 — min-h-[44px] explicito (WCAG 2.5.5 / FR-1.1); active:opacity-80 (FR-2.1)
              "flex items-center gap-3 rounded-lg px-4 py-3 min-h-[44px]",
              "motion-safe:transition-colors duration-200 active:opacity-80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
              isActive
                ? "bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            );

            // tabindex gerenciado pelo roving tabindex (initTabindex + onKeyDown).
            // Valor inicial: item ativo tem 0; demais têm -1 (setado no useLayoutEffect).
            const initialTabIndex = isActive ? 0 : index === 0 && items.findIndex((i) => i.key === activeKey) < 0 ? 0 : -1;

            if (renderLink) {
              return (
                <li key={item.key}>
                  {renderLink(
                    item,
                    <span className={linkClasses} tabIndex={initialTabIndex}>
                      {content}
                    </span>,
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
                  tabIndex={initialTabIndex}
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
