"use client";

import { useCallback, useRef } from "react";

export interface UseRovingTabindexOptions {
  /** Orientação do widget. 'vertical' (padrão): Arrow Up/Down. 'horizontal': Arrow Left/Right. 'both': todas as direções. */
  orientation?: "vertical" | "horizontal" | "both";
  /** Permite wrap circular (padrão: true). */
  wrap?: boolean;
}

export interface UseRovingTabindexReturn {
  /**
   * Ref a ser atribuída ao elemento container.
   * O hook gerencia tabindex de todos os filhos focáveis dentro deste container.
   */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Handler onKeyDown a ser aplicado no container. */
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

/**
 * Story 12.2 — CHK009
 *
 * Implementa o padrão ARIA Roving Tabindex para navegação por teclado em
 * widgets compostos (listbox, toolbar, menu, grid).
 *
 * Comportamento:
 * - Arrow Up/Down (vertical) ou Arrow Left/Right (horizontal): move foco entre itens.
 * - Home: foca o primeiro item.
 * - End: foca o último item.
 * - Enter/Space: aciona o item focado (click).
 * - Wrap circular: ao ultrapassar o último item, retorna ao primeiro (e vice-versa).
 *
 * Integração: adicione `containerRef` ao container e `onKeyDown` como handler.
 * Os itens focáveis devem ser elementos nativamente focáveis (button, a, [tabindex]).
 * O hook gerencia tabindex=0 (item ativo) e tabindex=-1 (demais) automaticamente.
 */
export function useRovingTabindex(
  options: UseRovingTabindexOptions = {},
): UseRovingTabindexReturn {
  const { orientation = "vertical", wrap = true } = options;
  const containerRef = useRef<HTMLElement | null>(null);

  /**
   * Retorna todos os filhos focáveis do container, excluindo elementos desabilitados.
   */
  const getFocusableItems = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    const candidates = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    );
    // Incluir também elementos com tabindex=0 explícito
    const all = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        "[tabindex]",
      ),
    ).filter((el) => {
      const ti = el.getAttribute("tabindex");
      return ti !== null && parseInt(ti, 10) >= 0;
    });

    // Unir ambas listas sem duplicatas
    const unique = Array.from(new Set([...candidates, ...all]));
    return unique.filter(
      (el) => !el.hasAttribute("disabled") && !el.closest("[disabled]"),
    );
  }, []);

  /**
   * Ativa um item: define tabindex=0 nele e tabindex=-1 nos demais.
   */
  const activateItem = useCallback(
    (items: HTMLElement[], index: number) => {
      items.forEach((item, i) => {
        item.setAttribute("tabindex", i === index ? "0" : "-1");
      });
      items[index]?.focus();
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const items = getFocusableItems();
      if (items.length === 0) return;

      const currentIndex = items.indexOf(
        document.activeElement as HTMLElement,
      );

      const isPrev =
        (orientation === "vertical" && event.key === "ArrowUp") ||
        (orientation === "horizontal" && event.key === "ArrowLeft") ||
        (orientation === "both" &&
          (event.key === "ArrowUp" || event.key === "ArrowLeft"));

      const isNext =
        (orientation === "vertical" && event.key === "ArrowDown") ||
        (orientation === "horizontal" && event.key === "ArrowRight") ||
        (orientation === "both" &&
          (event.key === "ArrowDown" || event.key === "ArrowRight"));

      if (isPrev) {
        event.preventDefault();
        const prevIndex =
          currentIndex <= 0
            ? wrap
              ? items.length - 1
              : 0
            : currentIndex - 1;
        activateItem(items, prevIndex);
        return;
      }

      if (isNext) {
        event.preventDefault();
        const nextIndex =
          currentIndex >= items.length - 1
            ? wrap
              ? 0
              : items.length - 1
            : currentIndex + 1;
        activateItem(items, nextIndex);
        return;
      }

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

      if (event.key === "Enter" || event.key === " ") {
        const current = document.activeElement as HTMLElement | null;
        if (current && containerRef.current?.contains(current)) {
          event.preventDefault();
          current.click();
        }
      }
    },
    [getFocusableItems, activateItem, orientation, wrap],
  );

  return { containerRef, onKeyDown };
}
