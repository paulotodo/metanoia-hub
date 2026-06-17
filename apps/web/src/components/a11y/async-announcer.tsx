"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type AnnouncePoliteness = "polite" | "assertive";

export interface AnnounceOptions {
  /**
   * Modo de aria-live:
   * - "polite" (padrão): aguarda pausa do leitor (CHK004 / WCAG 4.1.3).
   * - "assertive": interrompe imediatamente (usar apenas para erros críticos).
   */
  politeness?: AnnouncePoliteness;
  /**
   * Tempo em ms para limpar a região ARIA após o anúncio (padrão: 3000ms).
   * Evita que leitores re-leiam a mensagem ao navegar.
   */
  clearAfterMs?: number;
}

export interface AsyncAnnouncerContextValue {
  /**
   * Anuncia uma mensagem via região ARIA live.
   *
   * CHK004 — Provider transversal US1/US5/US6:
   * Usar para anunciar resultados de ações assíncronas (salvar, carregar,
   * submeter formulário, atualizar lista) a leitores de tela.
   */
  announce: (message: string, options?: AnnounceOptions) => void;
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

const AsyncAnnouncerContext = createContext<AsyncAnnouncerContextValue | null>(
  null,
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Story 12.2 — US1, US5, US6, CHK004
 *
 * Provider que expõe `announce()` para qualquer componente dentro da árvore.
 * Renderiza duas regiões ARIA live invisíveis (polite + assertive) para
 * compatibilidade máxima com leitores de tela.
 *
 * Estratégia de re-trigger AT: usa um contador `key` para forçar re-mount
 * da região ARIA, garantindo que leitores de tela detectem o novo conteúdo
 * mesmo que a mensagem seja idêntica à anterior.
 *
 * Inserir no layout autenticado (Server Component) envolvendo o conteúdo:
 * ```tsx
 * <AsyncAnnouncerProvider>
 *   {children}
 * </AsyncAnnouncerProvider>
 * ```
 */
export function AsyncAnnouncerProvider({ children }: { children: ReactNode }) {
  const [politeMsg, setPoliteMsg] = useState("");
  const [assertiveMsg, setAssertiveMsg] = useState("");
  const [politeKey, setPoliteKey] = useState(0);
  const [assertiveKey, setAssertiveKey] = useState(0);
  const politeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback(
    (message: string, options: AnnounceOptions = {}) => {
      const { politeness = "polite", clearAfterMs = 3000 } = options;

      if (politeness === "assertive") {
        if (assertiveTimer.current) clearTimeout(assertiveTimer.current);
        setAssertiveMsg(message);
        setAssertiveKey((k) => k + 1);
        assertiveTimer.current = setTimeout(
          () => setAssertiveMsg(""),
          clearAfterMs,
        );
      } else {
        if (politeTimer.current) clearTimeout(politeTimer.current);
        setPoliteMsg(message);
        setPoliteKey((k) => k + 1);
        politeTimer.current = setTimeout(
          () => setPoliteMsg(""),
          clearAfterMs,
        );
      }
    },
    [],
  );

  return (
    <AsyncAnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Regiões ARIA live — visualmente ocultas, acessíveis a AT */}
      <div
        key={politeKey}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="async-announcer-polite"
      >
        {politeMsg}
      </div>
      <div
        key={assertiveKey + 10000}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-testid="async-announcer-assertive"
      >
        {assertiveMsg}
      </div>
    </AsyncAnnouncerContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook de consumo
// ---------------------------------------------------------------------------

/**
 * Story 12.2 — CHK004
 *
 * Hook para consumir o `AsyncAnnouncerProvider`.
 *
 * ```tsx
 * const { announce } = useAsyncAnnouncer();
 * // ...
 * announce("Configurações salvas com sucesso");
 * announce("Erro ao salvar. Tente novamente.", { politeness: "assertive" });
 * ```
 *
 * Lança erro se usado fora do `AsyncAnnouncerProvider`.
 */
export function useAsyncAnnouncer(): AsyncAnnouncerContextValue {
  const ctx = useContext(AsyncAnnouncerContext);
  if (!ctx) {
    throw new Error(
      "[useAsyncAnnouncer] deve ser usado dentro de <AsyncAnnouncerProvider>. " +
        "Certifique-se de que o provider está no layout autenticado.",
    );
  }
  return ctx;
}
