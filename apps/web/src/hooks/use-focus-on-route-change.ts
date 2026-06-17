"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export interface UseFocusOnRouteChangeOptions {
  /**
   * CSS selector for the element to focus after a route change.
   *
   * CHK007 — Fallback chain (applied in order):
   *   1. options.selector (if provided)
   *   2. [data-autofocus]
   *   3. h1
   *   4. #conteudo (with tabIndex=-1 injected if missing)
   *
   * CHK036 — Nota sobre rotas dinâmicas:
   *   `usePathname()` retorna o pathname atual normalizado (ex: /groups/[id]).
   *   Em rotas com parâmetros dinâmicos, cada navegação para um segmento
   *   diferente (ex: /groups/123 → /groups/456) NÃO altera o pathname base,
   *   logo não dispara este hook. Use `useParams()` em conjunto quando precisar
   *   detectar mudanças dentro do mesmo segmento dinâmico.
   */
  selector?: string;
}

/**
 * Story 12.2 — US2, FR-006, FR-007, CL-001
 *
 * Observa `usePathname()` e move o foco programaticamente após mudança de
 * rota, garantindo que leitores de tela e usuários de teclado recebam foco
 * em ponto semântico relevante.
 *
 * Estratégia CHK007 (ordem de fallback):
 *   1. Seletor customizado (options.selector)
 *   2. [data-autofocus]
 *   3. h1
 *   4. #conteudo (tabIndex=-1 injetado se ausente)
 *
 * Nota CHK036: não detecta mudanças dentro de segmentos dinâmicos (ex:
 * /groups/123 → /groups/456). Para isso, combine com useParams().
 */
export function useFocusOnRouteChange(
  options?: UseFocusOnRouteChangeOptions,
): void {
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    // Não disparar no mount inicial — apenas em navegações subsequentes
    if (prevPathname.current === null) {
      prevPathname.current = pathname;
      return;
    }

    // Sem mudança de pathname, sem ação
    if (prevPathname.current === pathname) {
      return;
    }

    prevPathname.current = pathname;

    // Estratégia de seleção CHK007: fallback em cadeia
    const target = resolveTarget(options?.selector);
    if (target) {
      target.focus({ preventScroll: false });
    }
  }, [pathname, options?.selector]);
}

/**
 * Resolve o elemento alvo de foco aplicando a cadeia de fallback CHK007.
 * Retorna null se nenhum candidato for encontrado (sem foco — fail silent).
 */
function resolveTarget(customSelector?: string): HTMLElement | null {
  if (typeof document === "undefined") return null;

  // 1. Seletor customizado
  if (customSelector) {
    const el = document.querySelector<HTMLElement>(customSelector);
    if (el) return el;
  }

  // 2. [data-autofocus]
  const autofocus = document.querySelector<HTMLElement>("[data-autofocus]");
  if (autofocus) return autofocus;

  // 3. h1
  const h1 = document.querySelector<HTMLElement>("h1");
  if (h1) return h1;

  // 4. #conteudo — injetar tabIndex=-1 se ausente para permitir foco programático
  const main = document.querySelector<HTMLElement>("#conteudo");
  if (main) {
    if (!main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
    }
    return main;
  }

  return null;
}
