"use client";

import { useFocusOnRouteChange } from "@/hooks/use-focus-on-route-change";

/**
 * Story 12.2 — CL-001, TD-001
 *
 * Wrapper Client Component que materializa `useFocusOnRouteChange` no contexto
 * do layout Server autenticado. Segue o padrão de separação SSR/CSR do projeto:
 * o layout Server não pode usar hooks, então este componente Client é inserido
 * no layout como filho, ativando o gerenciamento de foco em toda a área autenticada.
 *
 * Uso no layout Server:
 * ```tsx
 * // app/(authenticated)/layout.tsx
 * import { FocusManager } from './_components/focus-manager';
 * // ...
 * <FocusManager />
 * <NavigationShell>{children}</NavigationShell>
 * ```
 *
 * O componente não renderiza DOM visível — é puramente comportamental.
 */
export function FocusManager({
  selector,
}: {
  /** Seletor CSS customizado para target de foco (repassado ao useFocusOnRouteChange). */
  selector?: string;
} = {}) {
  useFocusOnRouteChange({ selector });
  return null;
}
